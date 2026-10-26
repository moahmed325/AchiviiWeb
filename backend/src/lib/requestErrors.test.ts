import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { currentRequestId, requestContext } from './requestContext.js';
import { ExternalServiceError, PolicyError, ValidationError, errorHandler } from './httpErrors.js';

// B-105: request ids and typed errors answered in one place.

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.get('/id', (_req, res) => {
    res.json({ id: currentRequestId() });
  });
  app.get('/bad', () => {
    throw new ValidationError('Pick a week from 1 to 12.', 'bad_week');
  });
  app.get('/policy', (_req, _res, next) => next(new PolicyError('Pro is needed.', 'pro_required', 403)));
  app.get('/down', () => {
    throw new ExternalServiceError("Couldn't reach the model.");
  });
  app.get('/boom', () => {
    throw new Error('secret detail');
  });
  app.post('/json', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('request ids', () => {
  it('gives each request an id, sent back in X-Request-Id and readable inside the request', async () => {
    const res = await fetch(`${baseUrl}/id`);
    const id = res.headers.get('x-request-id');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(((await res.json()) as { id: string }).id).toBe(id);
  });

  it("keeps a safe id the caller sent, and replaces one that isn't", async () => {
    expect((await fetch(`${baseUrl}/id`, { headers: { 'X-Request-Id': 'client-abc-123' } })).headers.get('x-request-id')).toBe('client-abc-123');
    expect((await fetch(`${baseUrl}/id`, { headers: { 'X-Request-Id': 'bad id <script>' } })).headers.get('x-request-id')).not.toBe('bad id <script>');
  });
});

describe('errorHandler', () => {
  it('answers typed errors with their status, message, reason and the request id', async () => {
    const bad = await fetch(`${baseUrl}/bad`);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'Pick a week from 1 to 12.', reason: 'bad_week', requestId: bad.headers.get('x-request-id') });
    expect((await fetch(`${baseUrl}/policy`)).status).toBe(403);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await fetch(`${baseUrl}/down`)).status).toBe(503);
    error.mockRestore();
  });

  it('never shows an unexpected error to the caller, and logs it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await fetch(`${baseUrl}/boom`);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toContain('secret detail');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('answers a body that is not JSON with 400', async () => {
    const res = await fetch(`${baseUrl}/json`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'bad_json' });
  });
});
