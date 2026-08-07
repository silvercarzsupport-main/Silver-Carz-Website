-- =============================================================================
-- 20260807044255 — Harden payment RPC grants (C6)
-- =============================================================================
-- Revoke PUBLIC/anon execute on payment SECURITY DEFINER helpers.
-- Customers use authenticated grants; webhook uses service_role only.
-- =============================================================================

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

REVOKE ALL ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_booking_payment_attempt(uuid, numeric, text, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_own_payment_attempt_outcome(uuid, public.booking_payment_status, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.attach_payment_provider_payment_id(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.attach_payment_provider_payment_id(text, text) TO service_role;
