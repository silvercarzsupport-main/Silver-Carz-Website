-- =============================================================================
-- 20260817183000 — Harden online booking payments + schedule integrity (C7)
-- =============================================================================
-- Apply order: after 20260814123000_add_vehicle_city.sql
--
-- 1. Grant SELECT on payments (writes stay RPC-only).
-- 2. Bind checkout amount to the booking remaining balance.
-- 3. Authoritative complete_booking_payment (service_role) for C7.
-- 4. Hide other customers' names/invoices from the conflict RPC.
-- 5. Prevent overlapping confirmed/ongoing hires at the database.
-- 6. Payment hold window on approval; auto-release unpaid overdue holds.
-- 7. Restrict invoice sequence allocation to service_role.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- payments table privileges (match every other public table in this repo)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

-- ---------------------------------------------------------------------------
-- Payment hold window — unpaid approved requests expire and free the car
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;

COMMENT ON COLUMN public.bookings.payment_due_at IS
  'When an approved unpaid customer request must be paid. NULL = no hold (admin-created / already collected).';

CREATE INDEX IF NOT EXISTS bookings_overdue_unpaid_idx
  ON public.bookings (payment_due_at)
  WHERE status IN (
    'confirmed'::public.booking_status,
    'ongoing'::public.booking_status
  )
  AND booking_amount = 0
  AND payment_due_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Release unpaid approved holds that missed the payment window.
-- Skips in-flight Razorpay checkouts (pending attempt in the last 45 minutes).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_overdue_unpaid_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released integer := 0;
BEGIN
  WITH overdue AS (
    SELECT b.id
    FROM public.bookings AS b
    WHERE b.status IN (
        'confirmed'::public.booking_status,
        'ongoing'::public.booking_status
      )
      AND coalesce(b.booking_amount, 0) = 0
      AND b.payment_due_at IS NOT NULL
      AND b.payment_due_at < timezone('utc', now())
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments AS p
        WHERE p.booking_id = b.id
          AND p.status = 'pending'::public.booking_payment_status
          AND p.created_at > timezone('utc', now()) - interval '45 minutes'
      )
    FOR UPDATE OF b SKIP LOCKED
  ),
  updated AS (
    UPDATE public.bookings AS b
    SET
      status = 'cancelled'::public.booking_status,
      notes = nullif(
        trim(
          both FROM concat_ws(
            E'\n',
            nullif(btrim(coalesce(b.notes, '')), ''),
            'Released automatically because payment was not received in time.'
          )
        ),
        ''
      )
    FROM overdue
    WHERE b.id = overdue.id
    RETURNING b.id
  )
  SELECT count(*)::integer INTO released FROM updated;

  RETURN coalesce(released, 0);
END;
$$;

COMMENT ON FUNCTION public.release_overdue_unpaid_bookings() IS
  'Cancels approved unpaid bookings past payment_due_at so the vehicle returns to the calendar.';

REVOKE ALL ON FUNCTION public.release_overdue_unpaid_bookings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_overdue_unpaid_bookings() FROM anon;
REVOKE ALL ON FUNCTION public.release_overdue_unpaid_bookings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_overdue_unpaid_bookings() TO service_role;

-- ---------------------------------------------------------------------------
-- Conflict RPC: free overdue holds, hide PII from customers
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

  PERFORM public.release_overdue_unpaid_bookings();

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

-- ---------------------------------------------------------------------------
-- No two confirmed/ongoing hires may overlap on the same vehicle
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bookings AS a
    JOIN public.bookings AS b
      ON a.vehicle_id = b.vehicle_id
     AND a.id < b.id
    WHERE a.status IN ('confirmed'::public.booking_status, 'ongoing'::public.booking_status)
      AND b.status IN ('confirmed'::public.booking_status, 'ongoing'::public.booking_status)
      AND a.delivery_date <= b.return_date
      AND a.return_date >= b.delivery_date
  ) THEN
    RAISE EXCEPTION
      'Overlapping confirmed/ongoing bookings exist. Resolve them before applying bookings_no_overlapping_active_hires.';
  END IF;
END;
$$;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlapping_active_hires;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlapping_active_hires
  EXCLUDE USING gist (
    vehicle_id WITH =,
    daterange(delivery_date, return_date, '[]') WITH &&
  )
  WHERE (
    status IN (
      'confirmed'::public.booking_status,
      'ongoing'::public.booking_status
    )
  );

-- ---------------------------------------------------------------------------
-- Checkout RPC: amount must equal remaining balance; honour payment window
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_payment_attempt(
  p_booking_id uuid,
  p_amount numeric,
  p_currency text,
  p_provider_order_id text,
  p_receipt text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking_row public.bookings;
  existing_paid public.payments;
  existing_pending public.payments;
  inserted public.payments;
  normalized_currency text;
  expected_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'Booking id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  normalized_currency := upper(trim(coalesce(p_currency, 'INR')));
  IF char_length(normalized_currency) <> 3 THEN
    RAISE EXCEPTION 'Payment currency is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF p_provider_order_id IS NULL OR char_length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'Provider order id is required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_booking_id::text, 0));

  SELECT b.* INTO booking_row
  FROM public.bookings AS b
  WHERE b.id = p_booking_id
  FOR UPDATE;

  IF booking_row.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF booking_row.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Booking not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF booking_row.status NOT IN (
    'confirmed'::public.booking_status,
    'ongoing'::public.booking_status
  ) THEN
    RAISE EXCEPTION 'Booking is not eligible for payment'
      USING ERRCODE = '23514';
  END IF;

  IF coalesce(booking_row.booking_amount, 0) > 0 THEN
    RAISE EXCEPTION 'Payment already completed'
      USING ERRCODE = '23505';
  END IF;

  IF booking_row.payment_due_at IS NOT NULL
     AND booking_row.payment_due_at < timezone('utc', now()) THEN
    RAISE EXCEPTION 'Payment window has expired'
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

  SELECT p.* INTO existing_paid
  FROM public.payments AS p
  WHERE p.booking_id = p_booking_id
    AND p.status = 'paid'::public.booking_payment_status
  LIMIT 1;

  IF existing_paid.id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment already completed'
      USING ERRCODE = '23505';
  END IF;

  SELECT p.* INTO existing_pending
  FROM public.payments AS p
  WHERE p.booking_id = p_booking_id
    AND p.customer_id = auth.uid()
    AND p.status = 'pending'::public.booking_payment_status
    AND p.amount = round(p_amount, 2)
    AND upper(p.currency) = normalized_currency
    AND p.provider_order_id IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_pending.id IS NOT NULL THEN
    RETURN existing_pending;
  END IF;

  UPDATE public.payments AS p
  SET
    status = 'cancelled'::public.booking_payment_status,
    failure_reason = coalesce(p.failure_reason, 'Superseded by a new payment attempt')
  WHERE p.booking_id = p_booking_id
    AND p.status = 'pending'::public.booking_payment_status;

  INSERT INTO public.payments (
    booking_id,
    customer_id,
    provider,
    status,
    amount,
    currency,
    provider_order_id,
    receipt,
    metadata
  )
  VALUES (
    p_booking_id,
    auth.uid(),
    'razorpay'::public.payment_provider,
    'pending'::public.booking_payment_status,
    round(p_amount, 2),
    normalized_currency,
    trim(p_provider_order_id),
    NULLIF(trim(p_receipt), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- C7: mark paid + collect booking_amount after gateway verification
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

  -- Idempotent if another attempt already collected this booking (webhook retry).
  IF coalesce(booking_row.booking_amount, 0) >= booking_row.total_amount THEN
    RETURN payment_row;
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
  'C7: mark a verified Razorpay payment paid and collect booking_amount. service_role only.';

REVOKE ALL ON FUNCTION public.complete_booking_payment(text, text, numeric, text, public.payment_method) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_booking_payment(text, text, numeric, text, public.payment_method) FROM anon;
REVOKE ALL ON FUNCTION public.complete_booking_payment(text, text, numeric, text, public.payment_method) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_booking_payment(text, text, numeric, text, public.payment_method)
  TO service_role;

-- Failed gateway webhooks: pending → failed only (never touches paid).
CREATE OR REPLACE FUNCTION public.mark_payment_attempt_failed_by_order(
  p_provider_order_id text,
  p_provider_payment_id text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_row public.payments;
BEGIN
  IF p_provider_order_id IS NULL OR char_length(trim(p_provider_order_id)) = 0 THEN
    RAISE EXCEPTION 'Provider order id is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO payment_row
  FROM public.payments AS p
  WHERE p.provider_order_id = trim(p_provider_order_id)
  FOR UPDATE;

  IF payment_row.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF payment_row.status = 'paid'::public.booking_payment_status THEN
    RETURN payment_row;
  END IF;

  IF payment_row.status IS DISTINCT FROM 'pending'::public.booking_payment_status THEN
    RETURN payment_row;
  END IF;

  UPDATE public.payments AS p
  SET
    status = 'failed'::public.booking_payment_status,
    provider_payment_id = coalesce(
      NULLIF(trim(p_provider_payment_id), ''),
      p.provider_payment_id
    ),
    failure_reason = coalesce(
      NULLIF(trim(p_failure_reason), ''),
      p.failure_reason,
      'Payment failed at the gateway.'
    )
  WHERE p.id = payment_row.id
  RETURNING * INTO payment_row;

  RETURN payment_row;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_payment_attempt_failed_by_order(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_payment_attempt_failed_by_order(text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.mark_payment_attempt_failed_by_order(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_attempt_failed_by_order(text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Invoice sequences: customers must not burn numbers via RPC
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.next_invoice_sequence(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_invoice_sequence(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.next_invoice_sequence(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_sequence(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.peek_next_invoice_sequence(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.peek_next_invoice_sequence(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.peek_next_invoice_sequence(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.peek_next_invoice_sequence(text, integer) TO service_role;
