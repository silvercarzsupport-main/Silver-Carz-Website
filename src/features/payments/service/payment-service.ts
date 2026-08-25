/**
 * Customer booking payment service (C6 checkout + C7 verification).
 *
 * Orders are created server-side. Paid status is set only after Razorpay
 * capture is verified (checkout signature or webhook + Payments API).
 */

import 'server-only';

import { randomBytes } from 'node:crypto';

import { appConfig } from '@/config';
import { getRazorpayPublicKeyId } from '@/config/razorpay';
import {
  createPaymentAlreadyPaidError,
  createPaymentBookingNotFoundError,
  createPaymentConfigurationError,
  createPaymentDatabaseFailureError,
  createPaymentIneligibleError,
  createPaymentInvalidAmountError,
  createPaymentNotFoundError,
  createPaymentUnauthorizedError,
  createPaymentValidationError,
  createPaymentVerificationError,
  PAYMENT_ERROR_CODES,
} from '@/features/payments/errors';
import { getPaymentEligibility } from '@/features/payments/lib/eligibility';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  isCapturedRazorpayPayment,
  mapRazorpayMethodToPaymentMethod,
  toRazorpayAmountPaise,
  verifyRazorpayCheckoutSignature,
} from '@/features/payments/lib/razorpay-gateway';
import {
  createPaymentRepository,
  getPaymentRepository,
  type PaymentRepository,
} from '@/features/payments/repository/payment-repository';
import { APP_ROLES, requireUser, type AuthUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import {
  notifyBookingPaymentConfirmed,
  notifyBookingPaymentFailed,
} from '@/lib/notifications/booking-notifications';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromPromise } from '@/services';
import type {
  ApiResponse,
  BookingWithVehicle,
  Payment,
  PaymentMethod,
  PaymentSummary,
  RazorpayCheckoutSession,
} from '@/types';
import { toPaymentSummary } from '@/types/payment';
import { BOOKING_PAYMENT_STATUSES } from '@/types/enums';

export type PaymentServiceDeps = {
  readonly repository?: PaymentRepository;
  readonly client?: TypedSupabaseClient;
  readonly requireUser?: typeof requireUser;
};

export type PaymentPageData = {
  readonly booking: BookingWithVehicle;
  readonly eligibility: ReturnType<typeof getPaymentEligibility>;
  readonly payments: readonly PaymentSummary[];
  readonly latestPending: PaymentSummary | null;
};

export type PaymentService = {
  getPaymentPageData(bookingId: string): Promise<ApiResponse<PaymentPageData>>;
  createCheckoutSession(bookingId: string): Promise<ApiResponse<RazorpayCheckoutSession>>;
  confirmCheckout(input: {
    readonly bookingId: string;
    readonly razorpayOrderId: string;
    readonly razorpayPaymentId: string;
    readonly razorpaySignature: string;
  }): Promise<ApiResponse<PaymentSummary>>;
  completeCapturedGatewayPayment(input: {
    readonly razorpayOrderId: string;
    readonly razorpayPaymentId: string;
  }): Promise<ApiResponse<PaymentSummary>>;
  markGatewayAttemptFailed(input: {
    readonly razorpayOrderId: string;
    readonly razorpayPaymentId?: string | null;
    readonly reason?: string | null;
  }): Promise<ApiResponse<PaymentSummary>>;
  markAttemptFailed(input: {
    readonly paymentId: string;
    readonly reason?: string | null;
  }): Promise<ApiResponse<PaymentSummary>>;
  markAttemptCancelled(input: { readonly paymentId: string }): Promise<ApiResponse<PaymentSummary>>;
  listPaymentsForStaff(bookingId: string): Promise<ApiResponse<PaymentSummary[]>>;
};

function buildReceipt(invoiceNumber: string): string {
  const suffix = randomBytes(3).toString('hex');
  const base = invoiceNumber.replace(/[^A-Za-z0-9-]/g, '').slice(0, 28);
  return `${base}-${suffix}`.slice(0, 40);
}

function mapRpcError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  if (/Payment already completed/i.test(message)) {
    return createPaymentAlreadyPaidError();
  }
  if (/Payment window has expired/i.test(message)) {
    return createPaymentIneligibleError(
      'The payment window for this booking has ended. Contact Silver Carz if you still need this car.',
    );
  }
  if (/Payment amount does not match/i.test(message)) {
    return createPaymentInvalidAmountError();
  }
  if (/Booking not found|Payment not found/i.test(message)) {
    return createPaymentBookingNotFoundError();
  }
  if (/Authentication required/i.test(message)) {
    return createPaymentUnauthorizedError();
  }

  return createPaymentDatabaseFailureError(error);
}

async function requireCustomer(requireUserFn: typeof requireUser): Promise<AuthUser> {
  const user = await requireUserFn();
  if (user.role !== APP_ROLES.customer) {
    throw createPaymentUnauthorizedError();
  }
  return user;
}

export function createPaymentService(deps: PaymentServiceDeps = {}): PaymentService {
  const requireUserFn = deps.requireUser ?? requireUser;

  async function getClient(): Promise<TypedSupabaseClient> {
    return deps.client ?? (await createSupabaseServerClient());
  }

  async function getRepository(): Promise<PaymentRepository> {
    if (deps.repository) {
      return deps.repository;
    }
    if (deps.client) {
      return createPaymentRepository(deps.client);
    }
    return getPaymentRepository();
  }

  async function loadOwnBookingWithVehicle(
    client: TypedSupabaseClient,
    bookingId: string,
    userId: string,
  ): Promise<BookingWithVehicle> {
    const { data, error } = await client
      .from('bookings')
      .select(
        '*, vehicle:vehicles(id, vehicle_name, vehicle_number, image_path, availability_status, is_active, fuel_type, default_daily_rate, brand, color, transmission_type)',
      )
      .eq('id', bookingId)
      .eq('created_by', userId)
      .maybeSingle();

    if (error) {
      throw createPaymentDatabaseFailureError(error);
    }
    if (!data) {
      throw createPaymentBookingNotFoundError();
    }

    return data as BookingWithVehicle;
  }

  async function completeVerifiedPayment(input: {
    readonly orderId: string;
    readonly paymentId: string;
    readonly amountInr: number;
    readonly currency: string;
    readonly method: PaymentMethod;
  }): Promise<Payment> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc('complete_booking_payment', {
      p_provider_order_id: input.orderId,
      p_provider_payment_id: input.paymentId,
      p_amount: input.amountInr,
      p_currency: input.currency,
      p_payment_method: input.method,
    });

    if (error) {
      throw mapRpcError(error);
    }

    return data as Payment;
  }

  async function loadBookingForNotification(bookingId: string): Promise<BookingWithVehicle | null> {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('bookings')
      .select(
        '*, vehicle:vehicles(id, vehicle_name, vehicle_number, image_path, availability_status, is_active, fuel_type, default_daily_rate, brand, color, transmission_type)',
      )
      .eq('id', bookingId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as BookingWithVehicle;
  }

  async function maybeNotifyPaymentConfirmed(input: {
    readonly wasAlreadyPaid: boolean;
    readonly payment: Payment;
  }): Promise<void> {
    if (input.wasAlreadyPaid || input.payment.status !== BOOKING_PAYMENT_STATUSES.paid) {
      return;
    }

    const booking = await loadBookingForNotification(input.payment.booking_id);
    if (!booking) {
      return;
    }

    notifyBookingPaymentConfirmed({
      booking,
      amountPaid: Number(input.payment.amount),
    });
  }

  async function maybeNotifyPaymentFailed(payment: Payment): Promise<void> {
    if (payment.status !== BOOKING_PAYMENT_STATUSES.failed) {
      return;
    }

    const booking = await loadBookingForNotification(payment.booking_id);
    if (!booking) {
      return;
    }

    notifyBookingPaymentFailed({ booking, paymentId: payment.id });
  }

  async function verifyCapturedGatewayPayment(input: {
    readonly razorpayOrderId: string;
    readonly razorpayPaymentId: string;
  }): Promise<Payment> {
    const admin = createSupabaseAdminClient();
    const { data: existingAttempt } = await admin
      .from('payments')
      .select('status')
      .eq('provider_order_id', input.razorpayOrderId)
      .maybeSingle();

    const wasAlreadyPaid = existingAttempt?.status === BOOKING_PAYMENT_STATUSES.paid;

    const captured = await fetchRazorpayPayment(input.razorpayPaymentId);

    if (!isCapturedRazorpayPayment(captured.status)) {
      throw createPaymentVerificationError('Payment has not been captured yet.');
    }

    if (captured.orderId !== input.razorpayOrderId) {
      throw createPaymentVerificationError();
    }

    const row = await completeVerifiedPayment({
      orderId: captured.orderId,
      paymentId: captured.id,
      amountInr: captured.amountInr,
      currency: captured.currency,
      method: mapRazorpayMethodToPaymentMethod(captured.method),
    });

    await maybeNotifyPaymentConfirmed({ wasAlreadyPaid, payment: row });

    return row;
  }

  return {
    getPaymentPageData(bookingId) {
      return fromPromise(async () => {
        if (!bookingId?.trim()) {
          throw createPaymentValidationError('Booking id is required.');
        }

        const user = await requireCustomer(requireUserFn);
        const client = await getClient();
        const repository = await getRepository();
        const booking = await loadOwnBookingWithVehicle(client, bookingId, user.id);

        let payments: Payment[] = [];
        try {
          payments = await repository.listForBooking(bookingId);
        } catch (error) {
          throw mapRpcError(error);
        }

        const eligibility = getPaymentEligibility(booking, payments);
        const latestPending =
          payments.find((payment) => payment.status === BOOKING_PAYMENT_STATUSES.pending) ?? null;

        return {
          booking,
          eligibility,
          payments: payments.map(toPaymentSummary),
          latestPending: latestPending ? toPaymentSummary(latestPending) : null,
        };
      });
    },

    createCheckoutSession(bookingId) {
      return fromPromise(async () => {
        if (!bookingId?.trim()) {
          throw createPaymentValidationError('Booking id is required.');
        }

        const user = await requireCustomer(requireUserFn);
        const client = await getClient();
        const repository = await getRepository();
        const booking = await loadOwnBookingWithVehicle(client, bookingId, user.id);

        let payments: Payment[] = [];
        try {
          payments = await repository.listForBooking(bookingId);
        } catch (error) {
          throw mapRpcError(error);
        }

        const eligibility = getPaymentEligibility(booking, payments);
        if (eligibility.state === 'already_paid') {
          throw createPaymentAlreadyPaidError();
        }
        if (!eligibility.canPay) {
          throw createPaymentIneligibleError(eligibility.description);
        }
        if (!(eligibility.amountPayable > 0)) {
          throw createPaymentInvalidAmountError();
        }

        let keyId: string;
        try {
          keyId = getRazorpayPublicKeyId();
        } catch {
          throw createPaymentConfigurationError();
        }

        const amount = eligibility.amountPayable;
        const currency = eligibility.currency;
        const existingPending = payments.find(
          (payment) =>
            payment.status === BOOKING_PAYMENT_STATUSES.pending &&
            payment.provider_order_id &&
            Number(payment.amount) === amount &&
            payment.currency.toUpperCase() === currency,
        );

        let paymentRow: Payment;
        let orderId: string;
        let amountPaise: number;

        if (existingPending?.provider_order_id) {
          paymentRow = existingPending;
          orderId = existingPending.provider_order_id;
          amountPaise = toRazorpayAmountPaise(Number(existingPending.amount));
        } else {
          const order = await createRazorpayOrder({
            amountInr: amount,
            currency,
            receipt: buildReceipt(booking.invoice_number),
            notes: {
              booking_id: booking.id,
              customer_id: user.id,
              invoice_number: booking.invoice_number,
            },
          });

          try {
            paymentRow = await repository.createAttempt({
              bookingId: booking.id,
              amount,
              currency,
              providerOrderId: order.id,
              receipt: order.receipt,
              metadata: {
                booking_id: booking.id,
                customer_id: user.id,
                invoice_number: booking.invoice_number,
              },
            });
          } catch (error) {
            throw mapRpcError(error);
          }

          // Concurrent create may reuse another pending order — prefer DB authority.
          orderId = paymentRow.provider_order_id ?? order.id;
          amountPaise = toRazorpayAmountPaise(Number(paymentRow.amount));
        }

        return {
          paymentId: paymentRow.id,
          orderId,
          amountPaise,
          currency: paymentRow.currency.toUpperCase(),
          keyId,
          bookingId: booking.id,
          invoiceNumber: booking.invoice_number,
          customerName: booking.customer_name,
          customerContact: booking.contact_number,
          description: `${appConfig.companyName} booking ${booking.invoice_number}`,
        } satisfies RazorpayCheckoutSession;
      });
    },

    confirmCheckout(input) {
      return fromPromise(async () => {
        if (
          !input.bookingId?.trim() ||
          !input.razorpayOrderId?.trim() ||
          !input.razorpayPaymentId?.trim()
        ) {
          throw createPaymentValidationError('Payment confirmation details are required.');
        }

        const user = await requireCustomer(requireUserFn);
        const client = await getClient();
        await loadOwnBookingWithVehicle(client, input.bookingId, user.id);
        const repository = await getRepository();
        const payments = await repository.listForBooking(input.bookingId);
        const attempt = payments.find(
          (payment) => payment.provider_order_id === input.razorpayOrderId,
        );

        if (!attempt || attempt.customer_id !== user.id) {
          throw createPaymentVerificationError();
        }

        const signatureOk = verifyRazorpayCheckoutSignature({
          orderId: input.razorpayOrderId,
          paymentId: input.razorpayPaymentId,
          signature: input.razorpaySignature,
        });

        if (!signatureOk) {
          throw createPaymentVerificationError();
        }

        const row = await verifyCapturedGatewayPayment({
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
        });

        return toPaymentSummary(row);
      });
    },

    completeCapturedGatewayPayment(input) {
      return fromPromise(async () => {
        if (!input.razorpayOrderId?.trim() || !input.razorpayPaymentId?.trim()) {
          throw createPaymentValidationError('Payment confirmation details are required.');
        }

        const row = await verifyCapturedGatewayPayment(input);
        return toPaymentSummary(row);
      });
    },

    markGatewayAttemptFailed(input) {
      return fromPromise(async () => {
        if (!input.razorpayOrderId?.trim()) {
          throw createPaymentValidationError('Payment confirmation details are required.');
        }

        const admin = createSupabaseAdminClient();
        const { data, error } = await admin.rpc('mark_payment_attempt_failed_by_order', {
          p_provider_order_id: input.razorpayOrderId,
          p_provider_payment_id: input.razorpayPaymentId ?? null,
          p_failure_reason: input.reason ?? 'Payment failed at the gateway.',
        });

        if (error) {
          throw mapRpcError(error);
        }

        const payment = data as Payment;
        await maybeNotifyPaymentFailed(payment);
        return toPaymentSummary(payment);
      });
    },

    markAttemptFailed(input) {
      return fromPromise(async () => {
        await requireCustomer(requireUserFn);
        const repository = await getRepository();

        try {
          const row = await repository.updateOwnOutcome({
            paymentId: input.paymentId,
            status: BOOKING_PAYMENT_STATUSES.failed,
            failureReason: input.reason ?? 'Payment failed at the gateway.',
          });
          await maybeNotifyPaymentFailed(row);
          return toPaymentSummary(row);
        } catch (error) {
          const mapped = mapRpcError(error);
          if (mapped.code === PAYMENT_ERROR_CODES.bookingNotFound) {
            throw createPaymentNotFoundError();
          }
          throw mapped;
        }
      });
    },

    markAttemptCancelled(input) {
      return fromPromise(async () => {
        await requireCustomer(requireUserFn);
        const repository = await getRepository();

        try {
          const row = await repository.updateOwnOutcome({
            paymentId: input.paymentId,
            status: BOOKING_PAYMENT_STATUSES.cancelled,
            failureReason: 'Payment cancelled by customer.',
          });
          return toPaymentSummary(row);
        } catch (error) {
          const mapped = mapRpcError(error);
          if (mapped.code === PAYMENT_ERROR_CODES.bookingNotFound) {
            throw createPaymentNotFoundError();
          }
          throw mapped;
        }
      });
    },

    listPaymentsForStaff(bookingId) {
      return fromPromise(async () => {
        const user = await requireUserFn();
        if (user.role !== APP_ROLES.owner && user.role !== APP_ROLES.manager) {
          throw createPaymentUnauthorizedError();
        }

        if (!bookingId?.trim()) {
          throw createPaymentValidationError('Booking id is required.');
        }

        const repository = await getRepository();
        try {
          const payments = await repository.listForBooking(bookingId);
          return payments.map(toPaymentSummary);
        } catch (error) {
          throw mapRpcError(error);
        }
      });
    },
  };
}

let singleton: PaymentService | undefined;

export function getPaymentService(): PaymentService {
  return (singleton ??= createPaymentService());
}
