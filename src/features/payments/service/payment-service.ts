/**
 * Customer booking payment service (C6).
 *
 * Creates Razorpay orders server-side, records pending attempts, and never
 * marks bookings confirmed or payments paid (C7).
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
  PAYMENT_ERROR_CODES,
} from '@/features/payments/errors';
import { getPaymentEligibility } from '@/features/payments/lib/eligibility';
import {
  createRazorpayOrder,
  toRazorpayAmountPaise,
} from '@/features/payments/lib/razorpay-gateway';
import {
  createPaymentRepository,
  getPaymentRepository,
  type PaymentRepository,
} from '@/features/payments/repository/payment-repository';
import { APP_ROLES, requireUser, type AuthUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fromPromise } from '@/services';
import type {
  ApiResponse,
  BookingWithVehicle,
  Payment,
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
  if (/not eligible for payment/i.test(message)) {
    return createPaymentIneligibleError();
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
