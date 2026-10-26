import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * B-105: a request id on every request and every log line written while it runs. The id comes from the caller's
 * X-Request-Id when it looks safe, else a new one; it is sent back in the same header. `installRequestLogging` prefixes
 * console output inside a request with `[req <id>]`, so no log call has to pass the id along.
 */
const store = new AsyncLocalStorage<{ requestId: string }>();

export const currentRequestId = (): string | null => store.getStore()?.requestId ?? null;

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const given = req.headers['x-request-id'];
  const requestId = typeof given === 'string' && SAFE_ID.test(given) ? given : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  store.run({ requestId }, () => next());
}

let installed = false;

/** Prefixes console.log, info, warn and error with the request id while a request runs. Once per process. */
export function installRequestLogging(): void {
  if (installed) return;
  installed = true;
  for (const method of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const id = currentRequestId();
      if (id) original(`[req ${id}]`, ...args);
      else original(...args);
    };
  }
}
