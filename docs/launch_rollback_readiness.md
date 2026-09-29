# Achivii Billing Launch & Rollback Readiness

## New-purchase kill switch

Set `BILLING_CHECKOUT_ENABLED=false` in the backend runtime environment and restart/redeploy the backend. The `/billing/checkout` endpoint returns HTTP 503 and does not call Lemon Squeezy. This affects new purchases only; it does not revoke existing subscriptions or alter stored entitlements.

Restore `BILLING_CHECKOUT_ENABLED=true` (or remove the variable, since enabled is the default) and redeploy to resume checkout.

## When to disable new purchases

Disable checkout when webhook verification/state handling is failing, entitlements are being granted without verified provider events, checkout is creating incorrect variants or customer identity, credentials may be compromised, the provider is unavailable, or a billing deployment introduces a regression.

## Webhook failure diagnosis

1. Check application logs without logging secrets or full payment payloads.
2. Confirm the live webhook signing secret matches the Lemon Squeezy configuration.
3. Determine whether the event failed signature validation, persistence/idempotency, or lifecycle handling.
4. Inspect the webhook event/idempotency record for the provider event identifier.
5. If legitimate events are failing, disable new purchases while fixing the handler; never manually grant Pro.
6. Reprocess only through the verified/idempotent path after the underlying failure is fixed.

## Subscription-state reconciliation

Use the authenticated reconciliation endpoint to compare local state with provider state. Provider outage must not overwrite a known-good local entitlement. Reconciliation only updates the authenticated user's subscription and remains idempotent.

## Provider outage behavior

- Existing verified entitlements remain governed by local lifecycle rules.
- New checkout can be disabled with `BILLING_CHECKOUT_ENABLED=false`.
- Reconciliation reports provider unavailability rather than fabricating state.
- A client-side checkout return never grants Pro by itself.

## Credential rotation

Create replacement credentials where the provider permits overlap, update deployment secrets without committing values, deploy and verify, then revoke the old credential. Coordinate webhook-signing-secret rotation with provider configuration so legitimate events are not rejected. Record rotation date/environment, never the secret.

## Launch checklist

- [ ] Store activated and seller verification complete.
- [ ] Ethiopia bank-payout support confirmed and actual CBE payout destination accepted.
- [ ] Live Pro Monthly variant is `$9/month`.
- [ ] Live Pro Yearly variant is `$72/year`.
- [ ] Live credentials/secrets exist only in the production secret store.
- [ ] Production webhook URL and signature verification configured.
- [ ] Test-mode lifecycle, security, and regression suites pass.
- [ ] Controlled production smoke test passes with evidence.
- [ ] Rollback/disable procedure reviewed or exercised.
- [ ] No unresolved billing blocker remains.

## Rollback rule

If any launch acceptance criterion fails, keep `BILLING_CHECKOUT_ENABLED=false`, preserve existing verified subscription state, investigate using logs/event records, and do not manually grant entitlements. Resume checkout only after the failing criterion is revalidated.

## Scope boundary

M6.6 does not automatically start another payment/redesign phase. Future work requires an explicit new milestone/decision.