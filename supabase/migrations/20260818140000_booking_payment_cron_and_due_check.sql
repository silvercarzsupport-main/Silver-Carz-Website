-- =============================================================================
-- 20260818140000 — Payment window enforcement + overdue hold release cron
-- =============================================================================
-- 1. Reject late payment completion when the hold expired (45-minute in-flight grace).
-- 2. Schedule release_overdue_unpaid_bookings every 15 minutes via pg_cron.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- C7: enforce payment_due_at on completion (mirrors create-attempt + release RPC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_booking_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount numeric,
  p_currency text,
  p_payment_method public.payment_method DEFAULT 'other'::public.payment_method
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_row public.payments;
  booking_row public.bookings;
  expected_amount numeric;
  normalized_currency text;
BEGIN
  IF p_provider_order_id IS NULL OR char_length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'Provider order id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_provider_payment_id IS NULL OR char_length(trim(p_provider_payment_id)) = 0 THEN
    RAISE EXCEPTION 'Provider payment id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  normalized_currency := upper(trim(coalesce(p_currency, 'INR')));

  SELECT p.* INTO payment_row
  FROM public.payments AS p
  WHERE p.provider_order_id = trim(p_provider_order_id)
  FOR UPDATE;

  IF payment_row.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(payment_row.booking_id::text, 0));

  SELECT b.* INTO booking_row
  FROM public.bookings AS b
  WHERE b.id = payment_row.booking_id
  FOR UPDATE;

  IF booking_row.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF payment_row.status = 'paid'::public.booking_payment_status THEN
    RETURN payment_row;
  END IF;

  IF coalesce(booking_row.booking_amount, 0) >= booking_row.total_amount THEN
    RETURN payment_row;
  END IF;

  IF booking_row.payment_due_at IS NOT NULL
     AND booking_row.payment_due_at < timezone('utc', now())
     AND NOT (
       payment_row.status = 'pending'::public.booking_payment_status
       AND payment_row.created_at > timezone('utc', now()) - interval '45 minutes'
     ) THEN
    RAISE EXCEPTION 'Payment window has expired'
      USING ERRCODE = '23514';
  END IF;

  IF round(payment_row.amount, 2) IS DISTINCT FROM round(p_amount, 2)
     OR upper(payment_row.currency) IS DISTINCT FROM normalized_currency THEN
    RAISE EXCEPTION 'Payment amount does not match the recorded attempt'
      USING ERRCODE = '23514';
  END IF;

  expected_amount := round(
    booking_row.total_amount - coalesce(booking_row.booking_amount, 0),
    2
  );

  IF round(p_amount, 2) IS DISTINCT FROM expected_amount THEN
    RAISE EXCEPTION 'Payment amount does not match the booking balance'
      USING ERRCODE = '23514';
  END IF;

  IF booking_row.status NOT IN (
    'confirmed'::public.booking_status,
    'ongoing'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'Booking is not eligible for payment'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.payments AS p
  SET
    status = 'paid'::public.booking_payment_status,
    provider_payment_id = trim(p_provider_payment_id),
    failure_reason = NULL
  WHERE p.id = payment_row.id
  RETURNING * INTO payment_row;

  UPDATE public.bookings AS b
  SET
    booking_amount = round(b.booking_amount + p_amount, 2),
    payment_method = coalesce(p_payment_method, 'other'::public.payment_method),
    payment_due_at = NULL
  WHERE b.id = booking_row.id;

  RETURN payment_row;
END;
$$;

COMMENT ON FUNCTION public.complete_booking_payment(text, text, numeric, text, public.payment_method) IS
  'C7: mark a verified Razorpay payment paid and collect booking_amount. Enforces payment_due_at with in-flight grace. service_role only.';

-- ---------------------------------------------------------------------------
-- pg_cron: release unpaid holds every 15 minutes
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'release-overdue-unpaid-bookings';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'release-overdue-unpaid-bookings',
    '*/15 * * * *',
    $$SELECT public.release_overdue_unpaid_bookings();$$
  );
END;
$$;
