/**
 * Stripe Singleton Client Module — Phase 0 / M0.2
 *
 * Centralized Stripe client initialization with API version pinning and
 * environment-safe fallback handling. This module is the **only** location
 * in the codebase that imports the `stripe` package directly. All other
 * modules that need Stripe access must import from this file.
 *
 * Required environment variables (see .env.example):
 *   STRIPE_SECRET_KEY       — Stripe secret key (sk_test_* or sk_live_*)
 *   STRIPE_WEBHOOK_SECRET   — Webhook endpoint signing secret (whsec_*)
 *   STRIPE_PRICE_ID_MONTHLY — Stripe Price ID for the monthly Pro plan
 *   STRIPE_PRICE_ID_ANNUAL  — Stripe Price ID for the annual Pro plan
 */

import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Environment variable extraction with descriptive safety fallbacks
// ---------------------------------------------------------------------------

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY ?? '';
const STRIPE_PRICE_ID_ANNUAL = process.env.STRIPE_PRICE_ID_ANNUAL ?? '';

// ---------------------------------------------------------------------------
// Stripe API version pinning
// ---------------------------------------------------------------------------

/**
 * Pin the Stripe API version to ensure deterministic behavior across
 * deployments. This version must match the Stripe Dashboard's configured
 * API version for webhook payloads. Update only when deliberately upgrading
 * the Stripe API integration.
 */
const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

/**
 * Flag indicating whether the Stripe client is properly configured with
 * a real secret key. When `false`, calling `getStripe()` will throw a
 * descriptive error rather than silently sending requests with an empty key.
 *
 * This allows the backend to compile and boot cleanly in local/test
 * environments that have not yet configured Stripe credentials, while
 * ensuring runtime calls to Stripe will fail loudly and informatively.
 */
export const isStripeConfigured = STRIPE_SECRET_KEY.length > 0;

/**
 * Lazily-initialized Stripe singleton. The instance is created on first
 * access via `getStripe()`, not at module import time. This prevents
 * import-time exceptions when STRIPE_SECRET_KEY is not yet set.
 */
let _stripeInstance: Stripe | null = null;

/**
 * Returns the singleton Stripe client instance. Throws a descriptive
 * error if `STRIPE_SECRET_KEY` is not configured.
 *
 * @example
 * ```ts
 * import { getStripe } from '../lib/stripe.js';
 * const stripe = getStripe();
 * const session = await stripe.checkout.sessions.create({ ... });
 * ```
 */
export function getStripe(): Stripe {
  if (!isStripeConfigured) {
    throw new Error(
      '[Achivii] STRIPE_SECRET_KEY is not set. ' +
      'Stripe integration is unavailable. ' +
      'Set STRIPE_SECRET_KEY in your .env file to enable billing features.'
    );
  }

  if (!_stripeInstance) {
    _stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }

  return _stripeInstance;
}

// ---------------------------------------------------------------------------
// Exported configuration constants
// ---------------------------------------------------------------------------

/**
 * Billing configuration constants exported for use by checkout session
 * creation and webhook handlers. All values are sourced from environment
 * variables with empty-string fallbacks to prevent import-time crashes.
 */
export const stripeConfig = {
  /** Webhook endpoint signing secret for signature verification. */
  webhookSecret: STRIPE_WEBHOOK_SECRET,

  /** Stripe Price ID for the monthly Pro subscription. */
  priceIdMonthly: STRIPE_PRICE_ID_MONTHLY,

  /** Stripe Price ID for the annual Pro subscription. */
  priceIdAnnual: STRIPE_PRICE_ID_ANNUAL,

  /** Pinned Stripe API version string. */
  apiVersion: STRIPE_API_VERSION,
} as const;
