-- =============================================================================
-- 20260807043714 — Customer booking payments (C6)
-- =============================================================================
-- Apply order: after 20260806165305_add_booking_rejection_reason.sql
--
-- Gateway payment attempts for approved customer bookings.
-- C6 creates PENDING attempts and opens Razorpay checkout.
-- C7 will authoritatively mark PAID and update booking collection fields.
--
-- Does NOT: mark bookings confirmed, set booking_amount, or grant customers
-- broad UPDATE on bookings / payment status to paid.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'payment_provider'
  ) THEN
    CREATE TYPE public.payment_provider AS ENUM ('razorpay');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type AS t
    JOIN pg_namespace AS n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'booking_payment_status'
  ) THEN
    CREATE TYPE public.booking_payment_status AS ENUM (
      'pending',
      'failed',
      'cancelled',
      'paid'
    );
  END IF;
END;
$$;

COMMENT ON TYPE public.payment_provider IS
  'Online payment gateway used for a booking payment attempt.';
COMMENT ON TYPE public.booking_payment_status IS
  'Payment attempt lifecycle. paid is reserved for authoritative C7 verification.';

-- ---------------------------------------------------------------------------
-- Table: payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  provider public.payment_provider NOT NULL DEFAULT 'razorpay',
  status public.booking_payment_status NOT NULL DEFAULT 'pending',
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  provider_order_id text,
  provider_payment_id text,
  receipt text,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payments_amount_positive CHECK (amount > 0::numeric),
  CONSTRAINT payments_currency_not_blank CHECK (char_length(trim(currency)) = 3),
  CONSTRAINT payments_provider_order_id_not_blank CHECK (
    provider_order_id IS NULL OR char_length(trim(provider_order_id)) > 0
  ),
  CONSTRAINT payments_provider_payment_id_not_blank CHECK (
    provider_payment_id IS NULL OR char_length(trim(provider_payment_id)) > 0
  ),
  CONSTRAINT payments_receipt_not_blank CHECK (
    receipt IS NULL OR char_length(trim(receipt)) > 0
  ),
  CONSTRAINT payments_provider_order_id_unique UNIQUE (provider_order_id)
);

COMMENT ON TABLE public.payments IS
  'Gateway payment attempts for bookings. Historical failed/cancelled rows are retained.';
COMMENT ON COLUMN public.payments.amount IS
  'Authoritative amount charged for this attempt (INR major units). Never trusted from the browser.';
COMMENT ON COLUMN public.payments.provider_order_id IS
  'Gateway order identifier (e.g. Razorpay order_id).';
COMMENT ON COLUMN public.payments.provider_payment_id IS
  'Gateway payment identifier once known. Not sufficient alone for booking confirmation.';
COMMENT ON COLUMN public.payments.status IS
  'pending = order open; failed/cancelled = retryable; paid = C7 verified success.';

CREATE INDEX IF NOT EXISTS payments_booking_id_idx
  ON public.payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_customer_id_idx
  ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS payments_booking_status_idx
  ON public.payments (booking_id, status);
CREATE INDEX IF NOT EXISTS payments_provider_payment_id_idx
  ON public.payments (provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- At most one authoritative successful payment per booking.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_paid_per_booking_idx
  ON public.payments (booking_id)
  WHERE status = 'paid'::public.booking_payment_status;

DROP TRIGGER IF EXISTS payments_set_updated_at ON public.payments;
CREATE TRIGGER payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership integrity — customer_id must match booking owner
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_payment_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  booking_owner uuid;
BEGIN
  SELECT b.created_by INTO booking_owner
  FROM public.bookings AS b
  WHERE b.id = NEW.booking_id;

  IF booking_owner IS NULL THEN
    RAISE EXCEPTION 'Booking not found for payment'
      USING ERRCODE = '23503';
  END IF;

  IF NEW.customer_id IS DISTINCT FROM booking_owner THEN
    RAISE EXCEPTION 'Payment customer must match booking owner'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_payment_owner() IS
  'Ensures payments.customer_id always matches bookings.created_by.';

DROP TRIGGER IF EXISTS payments_enforce_owner ON public.payments;
CREATE TRIGGER payments_enforce_owner
  BEFORE INSERT OR UPDATE OF booking_id, customer_id ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_payment_owner();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS payments_select_staff ON public.payments;
CREATE POLICY payments_select_staff
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (public.is_active_staff());

-- Customers / anon must not INSERT / UPDATE / DELETE payment rows directly.
-- Writes go through SECURITY DEFINER helpers below.

-- ---------------------------------------------------------------------------
-- Create / reuse a pending payment attempt (customer-owned, approved booking)
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

  -- Serialize concurrent Pay Now attempts for the same booking.
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

  SELECT p.* INTO existing_paid
  FROM public.payments AS p
  WHERE p.booking_id = p_booking_id
    AND p.status = 'paid'::public.booking_payment_status
  LIMIT 1;

  IF existing_paid.id IS NOT NULL THEN
    RAISE EXCEPTION 'Payment already completed'
      USING ERRCODE = '23505';
  END IF;

  -- Reuse a valid pending attempt for the same amount when possible.
  SELECT p.* INTO existing_pending
  FROM public.payments AS p
  WHERE p.booking_id = p_booking_id
    AND p.customer_id = auth.uid()
    AND p.status = 'pending'::public.booking_payment_status
    AND p.amount = p_amount
    AND upper(p.currency) = normalized_currency
    AND p.provider_order_id IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_pending.id IS NOT NULL THEN
    RETURN existing_pending;
  END IF;

  -- Keep history, but close superseded pending attempts before opening a new one.
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
    p_amount,
    normalized_currency,
    trim(p_provider_order_id),
    NULLIF(trim(p_receipt), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO inserted;

  RETURN inserted;
END;
$$;

COMMENT ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) IS
  'Customer-owned helper: insert or reuse a pending payment attempt after server-side order creation.';

REVOKE ALL ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Customer may mark own pending attempt failed / cancelled (retryable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_own_payment_attempt_outcome(
  p_payment_id uuid,
  p_status public.booking_payment_status,
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_status IS DISTINCT FROM 'failed'::public.booking_payment_status
     AND p_status IS DISTINCT FROM 'cancelled'::public.booking_payment_status THEN
    RAISE EXCEPTION 'Only failed or cancelled outcomes are allowed'
      USING ERRCODE = '23514';
  END IF;

  SELECT p.* INTO payment_row
  FROM public.payments AS p
  WHERE p.id = p_payment_id
  FOR UPDATE;

  IF payment_row.id IS NULL OR payment_row.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Payment not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF payment_row.status = 'paid'::public.booking_payment_status THEN
    RAISE EXCEPTION 'Paid payments cannot be changed'
      USING ERRCODE = '23514';
  END IF;

  IF payment_row.status IS DISTINCT FROM 'pending'::public.booking_payment_status THEN
    RETURN payment_row;
  END IF;

  UPDATE public.payments AS p
  SET
    status = p_status,
    provider_payment_id = coalesce(
      NULLIF(trim(p_provider_payment_id), ''),
      p.provider_payment_id
    ),
    failure_reason = coalesce(NULLIF(trim(p_failure_reason), ''), p.failure_reason)
  WHERE p.id = payment_row.id
  RETURNING * INTO payment_row;

  RETURN payment_row;
END;
$$;

COMMENT ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) IS
  'Customer-owned helper: mark a pending attempt failed/cancelled. Never sets paid.';

REVOKE ALL ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- Webhook helper — attach gateway payment id after signature verification (C6/C7)
-- Does NOT mark paid and does NOT update bookings. C7 extends this path.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.attach_payment_provider_payment_id(
  p_provider_order_id text,
  p_provider_payment_id text
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

  IF p_provider_payment_id IS NULL OR char_length(trim(p_provider_payment_id)) = 0 THEN
    RAISE EXCEPTION 'Provider payment id is required'
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

  UPDATE public.payments AS p
  SET provider_payment_id = trim(p_provider_payment_id)
  WHERE p.id = payment_row.id
  RETURNING * INTO payment_row;

  RETURN payment_row;
END;
$$;

COMMENT ON FUNCTION public.attach_payment_provider_payment_id(text, text) IS
  'Webhook helper: store gateway payment id after signature verification. Does not mark paid (C7).';

-- Executable by service role only (webhook path). Not callable by anon/authenticated.
REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.attach_payment_provider_payment_id(text, text) TO service_role;
