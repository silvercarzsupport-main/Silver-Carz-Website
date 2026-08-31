/**
 * Invoice number service — database-backed, concurrency-safe allocation.
 *
 * Format: `{prefix}-{year}-{sequence}` (e.g. SC-2026-00001).
 * Never call from React components or Server Actions directly for allocation —
 * booking creation goes through the booking service, which calls this once.
 */

import 'server-only';

import {
  formatInvoiceNumber as formatInvoiceNumberValue,
  resolveInvoicePrefix,
  resolveInvoiceYear,
} from '@/config/invoice';
import {
  createBookingDatabaseFailureError,
  createInvoiceGenerationError,
} from '@/features/bookings/errors';
import { AppError } from '@/lib/errors';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface InvoiceNumberServiceDeps {
  readonly client?: TypedSupabaseClient;
  /** Optional prefix override (tests / future company settings). */
  readonly prefix?: string;
}

export interface GenerateInvoiceNumberOptions {
  /** ISO date (YYYY-MM-DD); year segment defaults to UTC today when omitted. */
  readonly issuedOn?: string;
  /** Optional prefix override for this call. */
  readonly prefix?: string;
}

export interface InvoiceNumberService {
  /** Atomically allocate and format the next invoice number. */
  generateNextInvoiceNumber(options?: GenerateInvoiceNumberOptions): Promise<string>;
  /**
   * Preview the next number without consuming a sequence.
   * For create-form display only — the real number is allocated on save.
   */
  previewNextInvoiceNumber(options?: GenerateInvoiceNumberOptions): Promise<string>;
  /** Pure formatter for an already-known sequence. */
  format(params: {
    readonly sequence: number;
    readonly issuedOn?: string;
    readonly prefix?: string;
  }): string;
}

function mapInvoiceRpcError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return createInvoiceGenerationError(error);
}

function assertSequence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw createInvoiceGenerationError();
  }

  return value;
}

export function createInvoiceNumberService(
  deps: InvoiceNumberServiceDeps = {},
): InvoiceNumberService {
  async function getClient(): Promise<TypedSupabaseClient> {
    if (deps.client) {
      return deps.client;
    }

    // Sequence RPCs are service_role-only so customers cannot burn invoice numbers.
    try {
      return createSupabaseAdminClient();
    } catch (error) {
      // Missing SUPABASE_SERVICE_ROLE_KEY is a plain Error — surface as invoice failure,
      // not a generic database_failure after the conflict check already succeeded.
      throw createInvoiceGenerationError(error);
    }
  }

  function resolvePrefix(override?: string): string {
    return resolveInvoicePrefix(override ?? deps.prefix);
  }

  const service: InvoiceNumberService = {
    async generateNextInvoiceNumber(options = {}) {
      try {
        const client = await getClient();
        const prefix = resolvePrefix(options.prefix);
        const year = resolveInvoiceYear(options.issuedOn);

        const { data, error } = await client.rpc('next_invoice_sequence', {
          p_prefix: prefix,
          p_year: year,
        });

        if (error) {
          throw mapInvoiceRpcError(error);
        }

        const sequence = assertSequence(data);

        return formatInvoiceNumberValue({ prefix, year, sequence });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw createBookingDatabaseFailureError(error);
      }
    },

    async previewNextInvoiceNumber(options = {}) {
      try {
        const client = await getClient();
        const prefix = resolvePrefix(options.prefix);
        const year = resolveInvoiceYear(options.issuedOn);

        const { data, error } = await client.rpc('peek_next_invoice_sequence', {
          p_prefix: prefix,
          p_year: year,
        });

        if (error) {
          throw mapInvoiceRpcError(error);
        }

        const sequence = assertSequence(data);

        return formatInvoiceNumberValue({ prefix, year, sequence });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw createBookingDatabaseFailureError(error);
      }
    },

    format(params) {
      const prefix = resolvePrefix(params.prefix);
      const year = resolveInvoiceYear(params.issuedOn);
      return formatInvoiceNumberValue({
        prefix,
        year,
        sequence: params.sequence,
      });
    },
  };

  return service;
}

/** Default request-scoped invoice number service. */
export function getInvoiceNumberService(): InvoiceNumberService {
  return createInvoiceNumberService();
}
