/**
 * Razorpay configuration (server secrets + public key).
 *
 * Public key may be sent to the browser for Checkout.
 * Key secret and webhook secret must never be exposed via NEXT_PUBLIC_*.
 */

import 'server-only';

export type RazorpayConfig = {
  readonly keyId: string;
  readonly keySecret: string;
  readonly webhookSecret: string | null;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy .env.example to .env.local and set your Razorpay credentials.',
    );
  }
  return value.trim();
}

function readConfig(): RazorpayConfig {
  return {
    keyId: requireEnv('NEXT_PUBLIC_RAZORPAY_KEY_ID', process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
    keySecret: requireEnv('RAZORPAY_KEY_SECRET', process.env.RAZORPAY_KEY_SECRET),
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null,
  };
}

let cached: RazorpayConfig | undefined;

function getConfig(): RazorpayConfig {
  return (cached ??= readConfig());
}

/** Validated Razorpay config. Accessors throw if required values are missing. */
export const razorpayConfig: RazorpayConfig = {
  get keyId() {
    return getConfig().keyId;
  },
  get keySecret() {
    return getConfig().keySecret;
  },
  get webhookSecret() {
    return getConfig().webhookSecret;
  },
};

/** Public key only — safe to return to Checkout. */
export function getRazorpayPublicKeyId(): string {
  return razorpayConfig.keyId;
}
