# Pay at vehicle pickup

Booking lifecycle status and payment collection are separate.

## Booking status

Stored and/or derived by the existing status engine:

- Draft / Pending Approval
- Confirmed
- Ongoing
- Completed
- Denied
- Cancelled

Admin approval moves a draft to the correct confirmed/lifecycle status, checks documents and vehicle conflicts, and **reserves the vehicle immediately**. Confirmation does not depend on payment.

A future admin **Mark as No-show** action can be added later. Confirmed unpaid bookings are **not** auto-cancelled when pickup time passes.

## Payment status

Stored on `bookings.payment_status`:

| Value    | Meaning                                      |
| -------- | -------------------------------------------- |
| `unpaid` | Collection not recorded                      |
| `paid`   | Staff recorded full collection at pickup     |

UI labels (not extra database values):

- Confirmed future hire: **Due at Pickup**
- Ongoing unpaid: **Payment Due** or **Payment Overdue**
- Collected: **Paid** (admin) / **Payment Collected** (customer)
- Draft, denied, cancelled: payment is not applicable

Related columns:

- `booking_amount` — amount collected (Pricing Engine `amountPaid`)
- `total_amount` — hire total (Pricing Engine `grandTotal`)
- `payment_method` — cash, UPI, card, bank transfer, cheque, other
- `payment_reference` — optional txn/cheque note
- `payment_collected_at` / `payment_collected_by` — audit of who recorded it

## Approval

1. Required documents must be complete.
2. Vehicle must be available; overlapping confirmed/ongoing hires are blocked.
3. Draft becomes confirmed/ongoing/completed via the status engine.
4. Payment stays `unpaid`. No payment window or deadline is created.
5. The customer is notified that the booking is confirmed and payment is due at pickup.

## Offline collection

Only an authenticated Owner or Manager with `bookings:write` can **Mark as Paid**.

1. Open the booking in the admin workspace.
2. Confirm amount (always the authoritative remaining/full total from the Pricing Engine — never a browser-supplied figure).
3. Choose payment method (default Cash) and optional reference.
4. Confirm Payment. A conditional update (`payment_status = unpaid`) prevents double collection.
5. The customer is notified (`payment_collected` / WhatsApp template `sc_payment_collected`).

There is no Unmark Paid action.

Customers cannot change payment fields (no UPDATE policy on bookings for customers; insert is draft-only; a trigger blocks non-staff collection writes).

## Notifications

Outbox + email (Resend) + WhatsApp Cloud API. Approval copy has no Pay Now link. Historic `payment_failed` / `payment_confirmed` event names may still exist on old outbox rows; the app only emits `payment_collected`.

## Security

- Server Action `markBookingPaid` uses `requirePermission(PERMISSIONS.bookingsWrite)`.
- Collection amount is computed server-side from the stored booking.
- Service-role key stays server-only.
