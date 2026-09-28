/**
 * Phase 0 / M0.4 — Stripe Singleton Client Module Tests
 *
 * Verifies the Stripe client initialization, environment safety fallbacks,
 * configuration exports, and lazy initialization behavior without requiring
 * a live Stripe secret key.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Stripe Singleton Client Module (M0.2 / M0.4)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Reset module cache so each test gets a fresh import
    vi.resetModules();
    // Clone env to avoid cross-test contamination
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reports isStripeConfigured = false when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { isStripeConfigured } = await import('../src/lib/stripe.js');
    expect(isStripeConfigured).toBe(false);
  });

  it('reports isStripeConfigured = true when STRIPE_SECRET_KEY is set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
    const { isStripeConfigured } = await import('../src/lib/stripe.js');
    expect(isStripeConfigured).toBe(true);
  });

  it('throws a descriptive error when getStripe() is called without STRIPE_SECRET_KEY', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { getStripe } = await import('../src/lib/stripe.js');
    expect(() => getStripe()).toThrowError(/STRIPE_SECRET_KEY is not set/);
  });

  it('returns a Stripe instance when STRIPE_SECRET_KEY is configured', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
    const { getStripe } = await import('../src/lib/stripe.js');
    const stripe = getStripe();
    expect(stripe).toBeDefined();
    expect(typeof stripe.customers).toBe('object');
  });

  it('returns the same singleton instance on repeated calls', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_testing';
    const { getStripe } = await import('../src/lib/stripe.js');
    const first = getStripe();
    const second = getStripe();
    expect(first).toBe(second);
  });

  it('exports stripeConfig with environment variable values', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
    process.env.STRIPE_PRICE_ID_MONTHLY = 'price_monthly_123';
    process.env.STRIPE_PRICE_ID_ANNUAL = 'price_annual_456';
    const { stripeConfig } = await import('../src/lib/stripe.js');
    expect(stripeConfig.webhookSecret).toBe('whsec_test_secret');
    expect(stripeConfig.priceIdMonthly).toBe('price_monthly_123');
    expect(stripeConfig.priceIdAnnual).toBe('price_annual_456');
    expect(stripeConfig.apiVersion).toBe('2026-08-26.dahlia');
  });

  it('defaults stripeConfig values to empty strings when env vars are missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_PRICE_ID_MONTHLY;
    delete process.env.STRIPE_PRICE_ID_ANNUAL;
    const { stripeConfig } = await import('../src/lib/stripe.js');
    expect(stripeConfig.webhookSecret).toBe('');
    expect(stripeConfig.priceIdMonthly).toBe('');
    expect(stripeConfig.priceIdAnnual).toBe('');
  });
});
