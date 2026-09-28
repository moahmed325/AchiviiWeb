/**
 * Phase 0 / M0.4 — Auth Billing Contract Tests
 *
 * Verifies that the isPro derivation logic and User billing interface
 * behave correctly across all subscription states. These are pure logic
 * tests — no DOM rendering or API calls required.
 */

import { describe, it, expect } from 'vitest';
import type { User } from '../types';

/**
 * Replicates the isPro derivation from AuthContext.tsx so it can be
 * unit-tested without React rendering overhead.
 */
function deriveIsPro(user: User | null): boolean {
  return Boolean(
    user?.plan === 'pro' &&
    (user?.subscriptionStatus === 'active' || !user?.subscriptionStatus)
  );
}

describe('isPro derivation (M0.3 / M0.4)', () => {
  const baseUser: User = {
    id: 'u-test',
    email: 'test@achivii.com',
    created_at: '2026-09-28T00:00:00Z',
  };

  it('returns false when user is null', () => {
    expect(deriveIsPro(null)).toBe(false);
  });

  it('returns false for a free-tier user with no billing fields', () => {
    expect(deriveIsPro(baseUser)).toBe(false);
  });

  it('returns false for an explicit free plan', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'free' })).toBe(false);
  });

  it('returns true for plan=pro with subscriptionStatus=active', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: 'active' })).toBe(true);
  });

  it('returns true for plan=pro with null subscriptionStatus (legacy/backfill)', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: null })).toBe(true);
  });

  it('returns true for plan=pro with undefined subscriptionStatus', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: undefined })).toBe(true);
  });

  it('returns false for plan=pro with subscriptionStatus=past_due', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: 'past_due' })).toBe(false);
  });

  it('returns false for plan=pro with subscriptionStatus=canceled', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: 'canceled' })).toBe(false);
  });

  it('returns false for plan=pro with subscriptionStatus=trialing', () => {
    expect(deriveIsPro({ ...baseUser, plan: 'pro', subscriptionStatus: 'trialing' })).toBe(false);
  });
});

describe('User billing interface shape (M0.3 / M0.4)', () => {
  it('accepts a complete billing user object without type errors', () => {
    const proUser: User = {
      id: 'u-pro',
      email: 'pro@achivii.com',
      timezone: 'Africa/Addis_Ababa',
      created_at: '2026-09-28T00:00:00Z',
      plan: 'pro',
      stripeCustomerId: 'cus_abc123',
      stripeSubscriptionId: 'sub_def456',
      subscriptionStatus: 'active',
      currentPeriodEnd: '2026-10-28T00:00:00Z',
      cancelAtPeriodEnd: false,
    };
    expect(proUser.plan).toBe('pro');
    expect(proUser.stripeCustomerId).toBe('cus_abc123');
    expect(proUser.cancelAtPeriodEnd).toBe(false);
  });

  it('accepts a minimal free user with no billing fields (backward compat)', () => {
    const freeUser: User = {
      id: 'u-free',
      email: 'free@achivii.com',
      created_at: '2026-09-28T00:00:00Z',
    };
    expect(freeUser.plan).toBeUndefined();
    expect(freeUser.stripeCustomerId).toBeUndefined();
  });

  it('accepts nullable billing fields as returned by the API for free users', () => {
    const apiUser: User = {
      id: 'u-api',
      email: 'api@achivii.com',
      created_at: '2026-09-28T00:00:00Z',
      plan: 'free',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
    expect(apiUser.plan).toBe('free');
    expect(apiUser.stripeCustomerId).toBeNull();
    expect(apiUser.cancelAtPeriodEnd).toBe(false);
  });
});
