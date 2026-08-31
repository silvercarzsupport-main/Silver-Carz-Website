-- =============================================================================
-- 20260831120000 — Pay at vehicle pickup (offline collection)
-- =============================================================================
-- Additive cleanup of online Razorpay payment infrastructure.
-- Does not edit previously applied migration files.
--
-- 1. Record collection on bookings (payment_status unpaid|paid).
-- 2. Backfill paid from booking_amount (this project never had a gateway table).
-- 3. Drop payment-window auto-cancel (cron + RPC).
-- 4. Drop Razorpay RPCs and related types if they exist.
-- 5. Notify payment_collected instead of online payment_confirmed.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum + booking collection columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'offline_payment_status'
  ) THEN
    CREATE TYPE public.offline_payment_status AS ENUM ('unpaid', 'paid');
  END IF;
END;
$$;

COMMENT ON TYPE public.offline_payment_status IS
  'Offline collection state for a booking. Independent of booking_status.';

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status public.offline_payment_status NOT NULL DEFAULT 'unpaid'::public.offline_payment_status;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_collected_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_collected_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_reference text;

COMMENT ON COLUMN public.bookings.payment_status IS
  'unpaid = due at pickup (when the booking is schedule-blocking); paid = staff recorded collection.';
COMMENT ON COLUMN public.bookings.payment_collected_at IS
  'When an authorized staff member recorded full collection. NULL while unpaid.';
COMMENT ON COLUMN public.bookings.payment_collected_by IS
  'Staff profile that recorded collection. NULL for historical backfills.';
COMMENT ON COLUMN public.bookings.payment_reference IS
  'Optional UPI/txn/cheque reference captured at collection.';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_reference_not_blank;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_reference_not_blank CHECK (
    payment_reference IS NULL OR char_length(trim(payment_reference)) > 0
  );

-- ---------------------------------------------------------------------------
-- Backfill from authoritative booking totals
-- ---------------------------------------------------------------------------
UPDATE public.bookings AS b
SET
  payment_status = 'paid'::public.offline_payment_status,
  payment_collected_at = coalesce(b.payment_collected_at, b.updated_at, b.created_at),
  payment_method = coalesce(b.payment_method, 'other'::public.payment_method)
WHERE b.payment_status = 'unpaid'::public.offline_payment_status
  AND coalesce(b.booking_amount, 0) > 0
  AND coalesce(b.booking_amount, 0) >= coalesce(b.total_amount, 0);

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_collection_integrity;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_payment_collection_integrity CHECK (
    (
      payment_status = 'unpaid'::public.offline_payment_status
      AND payment_collected_at IS NULL
      AND payment_collected_by IS NULL
    )
    OR (
      payment_status = 'paid'::public.offline_payment_status
      AND payment_collected_at IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS bookings_payment_status_idx
  ON public.bookings (payment_status)
  WHERE status IN (
    'confirmed'::public.booking_status,
    'ongoing'::public.booking_status,
    'completed'::public.booking_status
  );

CREATE INDEX IF NOT EXISTS bookings_payment_collected_by_idx
  ON public.bookings (payment_collected_by)
  WHERE payment_collected_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Customers must never write collection fields (defense in depth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_non_staff_payment_collection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_active_staff() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IS DISTINCT FROM 'unpaid'::public.offline_payment_status
       OR NEW.payment_collected_at IS NOT NULL
       OR NEW.payment_collected_by IS NOT NULL
       OR NEW.payment_reference IS NOT NULL
       OR coalesce(NEW.booking_amount, 0) <> 0 THEN
      RAISE EXCEPTION 'Customers cannot record booking payment'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.payment_collected_at IS DISTINCT FROM OLD.payment_collected_at
     OR NEW.payment_collected_by IS DISTINCT FROM OLD.payment_collected_by
     OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
     OR NEW.booking_amount IS DISTINCT FROM OLD.booking_amount
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'Customers cannot record booking payment'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_non_staff_payment_collection() IS
  'Blocks non-staff writes to offline payment-collection fields on bookings.';

DROP TRIGGER IF EXISTS bookings_prevent_non_staff_payment_collection ON public.bookings;
CREATE TRIGGER bookings_prevent_non_staff_payment_collection
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_non_staff_payment_collection();

DROP POLICY IF EXISTS bookings_insert_own_draft ON public.bookings;
CREATE POLICY bookings_insert_own_draft
  ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'draft'::public.booking_status
    AND document_submitted = false
    AND booking_amount = 0
    AND payment_method IS NULL
    AND payment_status = 'unpaid'::public.offline_payment_status
    AND payment_collected_at IS NULL
    AND payment_collected_by IS NULL
    AND payment_reference IS NULL
  );

-- ---------------------------------------------------------------------------
-- Notification events: payment_collected (keep historic names in CHECK)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_outbox
  DROP CONSTRAINT IF EXISTS notification_outbox_event_type_check;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_event_type_check CHECK (
    event_type IN (
      'booking_requested',
      'documents_submitted',
      'booking_approved',
      'booking_rejected',
      'payment_collected',
      'payment_failed',
      'payment_confirmed',
      'booking_cancelled',
      'booking_updated'
    )
  );

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

  IF OLD.payment_status IS DISTINCT FROM 'paid'::public.offline_payment_status
     AND NEW.payment_status = 'paid'::public.offline_payment_status THEN
    PERFORM public.insert_booking_notification_outbox(
      'booking:' || NEW.id::text || ':payment_collected',
      'payment_collected',
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
  'Enqueues customer booking notifications after insert/update, including offline payment collection.';

-- ---------------------------------------------------------------------------
-- Conflict RPC: no unpaid-hold auto-cancel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_vehicle_booking_conflicts(
  p_vehicle_id uuid,
  p_delivery_date date,
  p_return_date date,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  vehicle_id uuid,
  status public.booking_status,
  delivery_date date,
  return_date date,
  invoice_number text,
  customer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  include_pii boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_delivery_date IS NULL OR p_return_date IS NULL THEN
    RAISE EXCEPTION 'Delivery and return dates are required'
      USING ERRCODE = '22023';
  END IF;

  IF p_return_date < p_delivery_date THEN
    RAISE EXCEPTION 'Return date must be on or after the delivery date'
      USING ERRCODE = '22023';
  END IF;

  include_pii := public.is_active_staff();

  RETURN QUERY
  SELECT
    b.id,
    b.vehicle_id,
    b.status,
    b.delivery_date,
    b.return_date,
    CASE WHEN include_pii THEN b.invoice_number ELSE NULL END,
    CASE WHEN include_pii THEN b.customer_name ELSE NULL END
  FROM public.bookings AS b
  WHERE b.vehicle_id = p_vehicle_id
    AND b.status IN (
      'confirmed'::public.booking_status,
      'ongoing'::public.booking_status
    )
    AND b.delivery_date <= p_return_date
    AND b.return_date >= p_delivery_date
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
  ORDER BY b.delivery_date ASC;
END;
$$;

COMMENT ON FUNCTION public.list_vehicle_booking_conflicts(uuid, date, date, uuid) IS
  'Returns schedule-blocking bookings overlapping a vehicle/date window. Does not auto-cancel unpaid bookings.';

-- ---------------------------------------------------------------------------
-- Retire online-payment cron and RPCs (no gateway table on this project)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    SELECT jobid INTO job_id
    FROM cron.job
    WHERE jobname = 'release-overdue-unpaid-bookings';

    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_object OR invalid_schema_name THEN
    NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.create_booking_payment_attempt CASCADE;
DROP FUNCTION IF EXISTS public.attach_payment_provider_payment_id CASCADE;
DROP FUNCTION IF EXISTS public.release_overdue_unpaid_bookings CASCADE;
DROP FUNCTION IF EXISTS public.enforce_payment_owner CASCADE;
DROP FUNCTION IF EXISTS public.update_own_payment_attempt_outcome CASCADE;
DROP FUNCTION IF EXISTS public.complete_booking_payment CASCADE;
DROP FUNCTION IF EXISTS public.mark_payment_attempt_failed_by_order CASCADE;

DROP TYPE IF EXISTS public.payment_provider;
DROP TYPE IF EXISTS public.booking_payment_status;

DROP INDEX IF EXISTS public.bookings_overdue_unpaid_idx;

ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS payment_due_at;
