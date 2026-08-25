-- =============================================================================
-- 20260825120000 — Booking WhatsApp / email notification outbox
-- =============================================================================
-- 1. Customer phone + WhatsApp opt-in on profiles
-- 2. Durable notification_outbox (idempotent lifecycle events)
-- 3. Triggers enqueue customer booking events (including SQL overdue cancels)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: WhatsApp destination
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at timestamptz;

COMMENT ON COLUMN public.profiles.phone IS
  'E.164 mobile number used for transactional WhatsApp (e.g. +9198XXXXXXXX).';
COMMENT ON COLUMN public.profiles.whatsapp_opt_in IS
  'Customer consented to booking updates on WhatsApp.';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_e164;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_e164 CHECK (
    phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'
  );

CREATE INDEX IF NOT EXISTS profiles_phone_idx
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Outbox
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  event_type text NOT NULL,
  booking_id uuid REFERENCES public.bookings (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  email_status text,
  whatsapp_status text,
  whatsapp_message_id text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT notification_outbox_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT notification_outbox_event_type_check CHECK (
    event_type IN (
      'booking_requested',
      'documents_submitted',
      'booking_approved',
      'booking_rejected',
      'payment_failed',
      'payment_confirmed',
      'booking_cancelled',
      'booking_updated'
    )
  ),
  CONSTRAINT notification_outbox_status_check CHECK (
    status IN ('pending', 'processing', 'sent', 'skipped', 'failed')
  ),
  CONSTRAINT notification_outbox_attempts_non_negative CHECK (attempts >= 0)
);

COMMENT ON TABLE public.notification_outbox IS
  'Durable booking notification jobs. Application workers send email + WhatsApp.';

CREATE INDEX IF NOT EXISTS notification_outbox_pending_idx
  ON public.notification_outbox (created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS notification_outbox_booking_id_idx
  ON public.notification_outbox (booking_id);

DROP TRIGGER IF EXISTS notification_outbox_set_updated_at ON public.notification_outbox;
CREATE TRIGGER notification_outbox_set_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.notification_outbox FROM anon;
REVOKE ALL ON TABLE public.notification_outbox FROM authenticated;
GRANT ALL ON TABLE public.notification_outbox TO service_role;

CREATE POLICY notification_outbox_service_role
  ON public.notification_outbox
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Enqueue helper (never fails the originating booking write)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_booking_notification_outbox(
  p_idempotency_key text,
  p_event_type text,
  p_booking_id uuid,
  p_profile_id uuid,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_outbox (
    idempotency_key,
    event_type,
    booking_id,
    profile_id,
    payload
  )
  VALUES (
    p_idempotency_key,
    p_event_type,
    p_booking_id,
    p_profile_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notification outbox insert failed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.insert_booking_notification_outbox(text, text, uuid, uuid, jsonb) IS
  'Idempotent outbox insert. Errors are swallowed so booking writes never fail.';

REVOKE ALL ON FUNCTION public.insert_booking_notification_outbox(text, text, uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_booking_notification_outbox(text, text, uuid, uuid, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Lifecycle trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_booking_lifecycle_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_role public.app_role;
  payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL OR NEW.status <> 'draft'::public.booking_status THEN
      RETURN NEW;
    END IF;

    SELECT p.role INTO profile_role
    FROM public.profiles AS p
    WHERE p.id = NEW.created_by;

    IF profile_role IS DISTINCT FROM 'customer'::public.app_role THEN
      RETURN NEW;
    END IF;

    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':booking_requested',
      'booking_requested',
      NEW.id,
      NEW.created_by,
      jsonb_build_object(
        'invoice_number', NEW.invoice_number,
        'customer_name', NEW.customer_name
      )
    );
    RETURN NEW;
  END IF;

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
    'customer_name', NEW.customer_name,
    'rejection_reason', NEW.rejection_reason,
    'notes', NEW.notes
  );

  IF coalesce(OLD.document_submitted, false) = false AND NEW.document_submitted = true THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':documents_submitted',
      'documents_submitted',
      NEW.id,
      NEW.created_by,
      payload
    );
  END IF;

  IF OLD.status = 'draft'::public.booking_status
     AND NEW.status IN (
       'confirmed'::public.booking_status,
       'ongoing'::public.booking_status,
       'completed'::public.booking_status
     ) THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':booking_approved',
      'booking_approved',
      NEW.id,
      NEW.created_by,
      payload
    );
  END IF;

  IF OLD.status IS DISTINCT FROM 'denied'::public.booking_status
     AND NEW.status = 'denied'::public.booking_status THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':booking_rejected',
      'booking_rejected',
      NEW.id,
      NEW.created_by,
      payload
    );
  END IF;

  IF OLD.status IS DISTINCT FROM 'cancelled'::public.booking_status
     AND NEW.status = 'cancelled'::public.booking_status THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':booking_cancelled',
      'booking_cancelled',
      NEW.id,
      NEW.created_by,
      payload
    );
  END IF;

  IF coalesce(OLD.booking_amount, 0) = 0 AND coalesce(NEW.booking_amount, 0) > 0 THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':payment_confirmed',
      'payment_confirmed',
      NEW.id,
      NEW.created_by,
      payload || jsonb_build_object('amount_paid', NEW.booking_amount)
    );
  END IF;

  IF NEW.status NOT IN (
       'draft'::public.booking_status,
       'cancelled'::public.booking_status,
       'denied'::public.booking_status
     )
     AND (
       NEW.delivery_date IS DISTINCT FROM OLD.delivery_date
       OR NEW.return_date IS DISTINCT FROM OLD.return_date
       OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     ) THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':booking_updated:'
        || OLD.delivery_date::text || ':'
        || OLD.return_date::text || ':'
        || OLD.vehicle_id::text,
      'booking_updated',
      NEW.id,
      NEW.created_by,
      payload || jsonb_build_object(
        'previous_delivery_date', OLD.delivery_date,
        'previous_return_date', OLD.return_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_booking_lifecycle_notification() IS
  'Enqueues customer booking notifications after insert/update, including SQL overdue cancels.';

DROP TRIGGER IF EXISTS bookings_enqueue_lifecycle_notifications ON public.bookings;
CREATE TRIGGER bookings_enqueue_lifecycle_notifications
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_booking_lifecycle_notification();

-- Copy phone from signup metadata when present (never trust metadata for role).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role public.app_role;
  raw_phone text;
BEGIN
  resolved_role := public.resolve_profile_role_for_email(NEW.email);
  raw_phone := nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'phone', '')), '');

  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    NEW.id,
    coalesce(NEW.email, ''),
    nullif(trim(coalesce(NEW.raw_user_meta_data ->> 'full_name', '')), ''),
    resolved_role,
    CASE
      WHEN raw_phone ~ '^\+[1-9][0-9]{7,14}$' THEN raw_phone
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
