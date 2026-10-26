import type { NextFunction, Request, Response } from 'express';
import { currentRequestId } from './requestContext.js';

/**
 * B-105: typed errors, answered in one place (`errorHandler`, mounted last). A route can throw one of these (or pass it
 * to `next`) instead of shaping the answer itself; anything else is a 500 with the request id, logged once.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The machine-readable reason the app reads, when there is one. */
    readonly reason?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request is wrong (400). */
export class ValidationError extends HttpError {
  constructor(message: string, reason?: string) {
    super(400, message, reason);
  }
}

/** No signed-in user (401). */
export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized. Please sign in.') {
    super(401, message, 'unauthorized');
  }
}

/** A product rule refuses it (403 for entitlement, 409 for state). */
export class PolicyError extends HttpError {
  constructor(message: string, reason: string, status: 403 | 409 = 409) {
    super(status, message, reason);
  }
}

/** A service we depend on (the model, the payment provider) failed (503). */
export class ExternalServiceError extends HttpError {
  constructor(message: string, reason = 'external_service') {
    super(503, message, reason);
  }
}

// Express needs all four parameters to treat this as the error handler.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const requestId = currentRequestId();
  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(`[Error] ${err.name}: ${err.message}`);
    res.status(err.status).json({ error: err.message, ...(err.reason ? { reason: err.reason } : {}), ...(requestId ? { requestId } : {}) });
    return;
  }
  // A body that is not JSON (express.json) is the caller's mistake, not ours.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'The request body is not valid JSON.', reason: 'bad_json', ...(requestId ? { requestId } : {}) });
    return;
  }
  console.error('[Error] Unhandled:', err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.', ...(requestId ? { requestId } : {}) });
}
