# Lemon Squeezy Billing Configuration

The backend reads Lemon Squeezy configuration from environment variables only. These values must never be imported into frontend code.

## Environment selection

`LEMON_SQUEEZY_ENVIRONMENT` accepts only `test` or `production` and defaults to `test` when omitted.

The selected environment determines which complete configuration namespace is read:

- `test` → `LEMON_SQUEEZY_TEST_*`
- `production` → `LEMON_SQUEEZY_LIVE_*`

The configuration loader requires all five values in the selected namespace:

- Store ID
- API key
- Webhook signing secret
- Pro monthly variant ID
- Pro yearly variant ID

A partially configured selected environment fails closed when `getBillingConfig()` is called. Live credentials are never used while the environment is `test`, and test credentials are never used while the environment is `production`.

## Security

Never commit `.env` or real Lemon Squeezy credentials. The committed `.env.example` contains placeholders only. Provider API keys and webhook signing secrets are server-only.

## Production readiness

Live configuration must remain empty until seller onboarding, final Pro variants/pricing, webhook setup, and Ethiopian payout configuration have been verified. Configuring live credentials does not by itself establish payout readiness.

## Approved launch pricing

- Pro Monthly: **$9/month**.
- Pro Yearly: **$72/year**.
- Both are recurring Lemon Squeezy variants.
- Prices are authoritative in the Lemon Squeezy product/variant configuration, not environment variables.

## Payout readiness

Lemon Squeezy currently lists **Ethiopia** among countries supported for bank payouts. This is country-level support only. CBE compatibility remains an operational verification step: the actual CBE payout destination must be accepted during seller onboarding before launch is declared payout-ready.