-- =============================================================================
-- 20260914120000 — In-app admin notifications (website bell)
-- =============================================================================
-- Shared operational inbox for owner/manager. Customer WhatsApp/email outbox
-- is unchanged. Events: new customer request, documents submitted, cancelled.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  booking_id uuid REFERENCES public.bookings (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT admin_notifications_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT admin_notifications_event_type_check CHECK (
    event_type IN (
      'booking_requested',
      'documents_submitted',
      'booking_cancelled'
    )
  )
);

COMMENT ON TABLE public.admin_notifications IS
  'In-app staff inbox for customer booking events. Copy is derived in the app.';

CREATE INDEX IF NOT EXISTS admin_notifications_created_at_idx
  ON public.admin_notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_notifications_booking_id_idx
  ON public.admin_notifications (booking_id);

CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications (id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (notification_id, profile_id)
);

COMMENT ON TABLE public.admin_notification_reads IS
  'Per-staff read state for admin_notifications. Unread is computed per profile.';

CREATE INDEX IF NOT EXISTS admin_notification_reads_profile_id_idx
  ON public.admin_notification_reads (profile_id);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_notifications FROM anon;
REVOKE ALL ON TABLE public.admin_notification_reads FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_notification_reads FROM anon;

GRANT SELECT ON TABLE public.admin_notifications TO authenticated;
GRANT ALL ON TABLE public.admin_notifications TO service_role;

GRANT SELECT, INSERT ON TABLE public.admin_notification_reads TO authenticated;
GRANT ALL ON TABLE public.admin_notification_reads TO service_role;

DROP POLICY IF EXISTS admin_notifications_select_staff ON public.admin_notifications;
CREATE POLICY admin_notifications_select_staff
  ON public.admin_notifications
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

DROP POLICY IF EXISTS admin_notification_reads_select_own ON public.admin_notification_reads;
CREATE POLICY admin_notification_reads_select_own
  ON public.admin_notification_reads
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff() AND profile_id = auth.uid());

DROP POLICY IF EXISTS admin_notification_reads_insert_own ON public.admin_notification_reads;
CREATE POLICY admin_notification_reads_insert_own
  ON public.admin_notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_staff() AND profile_id = auth.uid());

CREATE OR REPLACE FUNCTION public.insert_admin_notification(
  p_idempotency_key text,
  p_event_type text,
  p_booking_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (
    idempotency_key,
    event_type,
    booking_id,
    payload
  )
  VALUES (
    p_idempotency_key,
    p_event_type,
    p_booking_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'admin notification insert failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.insert_admin_notification(text, text, uuid, jsonb) IS
  'Idempotent staff-inbox insert. Errors are swallowed so booking writes never fail.';

REVOKE ALL ON FUNCTION public.insert_admin_notification(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_admin_notification(text, text, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_admin_booking_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role public.app_role;
  payload jsonb;
BEGIN
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.role INTO profile_role
  FROM public.profiles AS p
  WHERE p.id = NEW.created_by;

  IF profile_role IS DISTINCT FROM 'customer'::public.app_role THEN
    RETURN NEW;
  END IF;

  payload := jsonb_build_object(
    'invoice_number', NEW.invoice_number,
    'customer_name', NEW.customer_name
  );

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'draft'::public.booking_status THEN
      PERFORM public.insert_admin_notification(
        'admin:booking:' || NEW.id::text || ':booking_requested',
        'booking_requested',
        NEW.id,
        payload
      );
    END IF;
    RETURN NEW;
  END IF;

  IF coalesce(OLD.document_submitted, false) = false AND NEW.document_submitted = true THEN
    PERFORM public.insert_admin_notification(
      'admin:booking:' || NEW.id::text || ':documents_submitted',
      'documents_submitted',
      NEW.id,
      payload
    );
  END IF;

  IF OLD.status IS DISTINCT FROM 'cancelled'::public.booking_status
     AND NEW.status = 'cancelled'::public.booking_status THEN
    PERFORM public.insert_admin_notification(
      'admin:booking:' || NEW.id::text || ':booking_cancelled',
      'booking_cancelled',
      NEW.id,
      payload
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_admin_booking_notification() IS
  'Enqueues staff inbox rows for customer booking request, documents, and cancel.';

DROP TRIGGER IF EXISTS bookings_enqueue_admin_notifications ON public.bookings;
CREATE TRIGGER bookings_enqueue_admin_notifications
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_admin_booking_notification();

CREATE OR REPLACE FUNCTION public.mark_all_admin_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer := 0;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Not allowed'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.admin_notification_reads (notification_id, profile_id)
  SELECT n.id, auth.uid()
  FROM public.admin_notifications AS n
  ON CONFLICT (notification_id, profile_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

COMMENT ON FUNCTION public.mark_all_admin_notifications_read() IS
  'Marks every staff-inbox row as read for the current owner/manager.';

REVOKE ALL ON FUNCTION public.mark_all_admin_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_admin_notifications_read() TO authenticated;

CREATE OR REPLACE FUNCTION public.count_unread_admin_notifications()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_active_staff() THEN (
      SELECT count(*)::integer
      FROM public.admin_notifications AS n
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.admin_notification_reads AS r
        WHERE r.notification_id = n.id
          AND r.profile_id = auth.uid()
      )
    )
    ELSE 0
  END;
$$;

COMMENT ON FUNCTION public.count_unread_admin_notifications() IS
  'Unread staff-inbox count for the current owner/manager.';

REVOKE ALL ON FUNCTION public.count_unread_admin_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unread_admin_notifications() TO authenticated;

-- Existing customer booking events so the inbox is not empty on first deploy.
INSERT INTO public.admin_notifications (
  idempotency_key,
  event_type,
  booking_id,
  payload
)
SELECT
  'admin:booking:' || b.id::text || ':booking_requested',
  'booking_requested',
  b.id,
  jsonb_build_object(
    'invoice_number', b.invoice_number,
    'customer_name', b.customer_name
  )
FROM public.bookings AS b
INNER JOIN public.profiles AS p ON p.id = b.created_by
WHERE p.role = 'customer'::public.app_role
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.admin_notifications (
  idempotency_key,
  event_type,
  booking_id,
  payload
)
SELECT
  'admin:booking:' || b.id::text || ':documents_submitted',
  'documents_submitted',
  b.id,
  jsonb_build_object(
    'invoice_number', b.invoice_number,
    'customer_name', b.customer_name
  )
FROM public.bookings AS b
INNER JOIN public.profiles AS p ON p.id = b.created_by
WHERE p.role = 'customer'::public.app_role
  AND b.document_submitted = true
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO public.admin_notifications (
  idempotency_key,
  event_type,
  booking_id,
  payload
)
SELECT
  'admin:booking:' || b.id::text || ':booking_cancelled',
  'booking_cancelled',
  b.id,
  jsonb_build_object(
    'invoice_number', b.invoice_number,
    'customer_name', b.customer_name
  )
FROM public.bookings AS b
INNER JOIN public.profiles AS p ON p.id = b.created_by
WHERE p.role = 'customer'::public.app_role
  AND b.status = 'cancelled'::public.booking_status
ON CONFLICT (idempotency_key) DO NOTHING;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;
