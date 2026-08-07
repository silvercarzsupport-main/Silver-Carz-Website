/**
 * Payment domain errors.
 * Safe for UI display — never wrap raw Supabase / Razorpay messages.
 */

import { AppError, ERROR_CODES } from '@/lib/errors';

export const PAYMENT_ERROR_CODES = {
  notFound: 'payment_not_found',
  bookingNotFound: 'payment_booking_not_found',
  ineligible: 'payment_ineligible',
  alreadyPaid: 'payment_already_completed',
  invalidAmount: 'payment_invalid_amount',
  gatewayFailure: 'payment_gateway_failure',
  databaseFailure: 'payment_database_failure',
  unauthorized: 'unauthorized_payment_access',
  configuration: 'payment_configuration',
  validation: ERROR_CODES.validation,
} as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[keyof typeof PAYMENT_ERROR_CODES];

export function createPaymentNotFoundError(): AppError {
  return new AppError('Payment not found.', PAYMENT_ERROR_CODES.notFound);
}

export function createPaymentBookingNotFoundError(): AppError {
  return new AppError('Booking not found.', PAYMENT_ERROR_CODES.bookingNotFound);
}

export function createPaymentIneligibleError(message?: string): AppError {
  return new AppError(
    message ?? 'This booking is not eligible for payment.',
    PAYMENT_ERROR_CODES.ineligible,
  );
}

export function createPaymentAlreadyPaidError(): AppError {
  return new AppError(
    'Payment already completed for this booking.',
    PAYMENT_ERROR_CODES.alreadyPaid,
  );
}

export function createPaymentInvalidAmountError(): AppError {
  return new AppError(
    'A valid payment amount could not be determined for this booking.',
    PAYMENT_ERROR_CODES.invalidAmount,
  );
}

export function createPaymentGatewayFailureError(cause?: unknown): AppError {
  return new AppError(
    'Unable to start payment right now. Please try again.',
    PAYMENT_ERROR_CODES.gatewayFailure,
    { cause },
  );
}

export function createPaymentDatabaseFailureError(cause?: unknown): AppError {
  return new AppError(
    'Unable to record the payment attempt. Please try again.',
    PAYMENT_ERROR_CODES.databaseFailure,
    { cause },
  );
}

export function createPaymentUnauthorizedError(): AppError {
  return new AppError(
    'You do not have permission to pay for this booking.',
    PAYMENT_ERROR_CODES.unauthorized,
  );
}

export function createPaymentConfigurationError(): AppError {
  return new AppError(
    'Online payments are not configured. Please contact Silver Carz.',
    PAYMENT_ERROR_CODES.configuration,
  );
}

export function createPaymentValidationError(message: string): AppError {
  return new AppError(message, PAYMENT_ERROR_CODES.validation);
}
