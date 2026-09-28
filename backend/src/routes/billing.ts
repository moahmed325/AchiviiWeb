/**
 * Billing Routes — Phase 2 (Stripe Checkout & Webhook Pipeline)
 *
 * Mounted at /api/billing by backend/src/index.ts. M2.1 installs honest 501
 * stubs only; each endpoint is implemented by its own milestone:
 *
 *   POST /webhook                 → M2.3 (signature verification + event handlers)
 *   POST /create-checkout-session → M2.2 (Stripe Checkout session creation)
 *   GET  /sync-status             → M2.4 (client fallback subscription sync)
 *
 * The webhook stub's `bodyIsBuffer` diagnostic proves that the raw-body
 * middleware (mounted before express.json()) is capturing the exact request
 * bytes, which Stripe signature verification will require.
 */

import { Router, Request, Response } from 'express';

export const billingRouter = Router();

// POST /api/billing/webhook — implemented in M2.3
billingRouter.post('/webhook', (req: Request, res: Response): void => {
  res.status(501).json({
    error: 'Webhook handler not implemented yet (M2.3).',
    bodyIsBuffer: Buffer.isBuffer(req.body),
  });
});

// POST /api/billing/create-checkout-session — implemented in M2.2
billingRouter.post('/create-checkout-session', (_req: Request, res: Response): void => {
  res.status(501).json({ error: 'Not implemented yet (M2.2).' });
});

// GET /api/billing/sync-status — implemented in M2.4
billingRouter.get('/sync-status', (_req: Request, res: Response): void => {
  res.status(501).json({ error: 'Not implemented yet (M2.4).' });
});
