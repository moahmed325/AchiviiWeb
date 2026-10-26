import type { NextFunction, Request, Response } from 'express';

/**
 * B-99 (6): a small in-memory rate limit for the routes that call the model, so nobody can run up the AI bill. A fixed
 * window per key; one process (Render runs one instance), so memory is enough. Over the limit: 429 with Retry-After.
 */
export interface RateLimitOptions {
  /** The window, in milliseconds. */
  windowMs: number;
  /** Requests allowed per key in one window. */
  max: number;
  /** Who is counted: the client IP, or the signed-in token when there is one. */
  keyOf: (req: Request) => string;
}

export const RATE_LIMITED = 'Too many requests. Please wait a minute and try again.';

export function rateLimit({ windowMs, max, keyOf }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    // Forget windows that have ended, so the map stays small.
    if (hits.size > 10_000) for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    const key = keyOf(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ error: RATE_LIMITED, reason: 'rate_limited' });
      return;
    }
    next();
  };
}

/** The client IP (Express reads X-Forwarded-For when `trust proxy` is set, as on Render). */
export const byIp = (req: Request) => `ip:${req.ip ?? 'unknown'}`;

/** The bearer token when signed in, else the IP. */
export const byTokenOrIp = (req: Request) => {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? `token:${auth.slice(7, 47)}` : byIp(req);
};

/**
 * The routes' limit. Off inside the test runner (Vitest sets VITEST), where many requests share one fake token; the
 * limiter itself is tested on its own (`rateLimit.test.ts`).
 */
export function routeLimit(options: RateLimitOptions) {
  if (process.env.VITEST) return (_req: Request, _res: Response, next: NextFunction) => next();
  return rateLimit(options);
}
