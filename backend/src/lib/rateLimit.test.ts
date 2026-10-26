import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { RATE_LIMITED, byTokenOrIp, rateLimit } from './rateLimit.js';

const req = (ip: string, auth?: string) => ({ ip, headers: auth ? { authorization: auth } : {} }) as unknown as Request;
function res() {
  const out = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  const r = {
    setHeader: (k: string, v: string) => (out.headers[k] = v),
    status: (code: number) => ((out.statusCode = code), r),
    json: (body: unknown) => ((out.body = body), r),
  };
  return { r: r as unknown as Response, out };
}

describe('rateLimit (B-99 (6))', () => {
  it('lets max requests through per key and window, then answers 429 with Retry-After', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T10:00:00Z'));
    const limit = rateLimit({ windowMs: 60_000, max: 2, keyOf: (r) => r.ip! });
    const next = vi.fn();
    for (let i = 0; i < 2; i += 1) limit(req('1.1.1.1'), res().r, next);
    const third = res();
    limit(req('1.1.1.1'), third.r, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(third.out.statusCode).toBe(429);
    expect(third.out.body).toEqual({ error: RATE_LIMITED, reason: 'rate_limited' });
    expect(third.out.headers['Retry-After']).toBe('60');
    // Another IP has its own count, and a new window starts fresh.
    limit(req('2.2.2.2'), res().r, next);
    vi.setSystemTime(new Date('2026-10-26T10:01:01Z'));
    limit(req('1.1.1.1'), res().r, next);
    expect(next).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('counts a signed-in person by token, else by IP', () => {
    expect(byTokenOrIp(req('1.1.1.1', 'Bearer abc'))).toBe('token:abc');
    expect(byTokenOrIp(req('1.1.1.1'))).toBe('ip:1.1.1.1');
  });
});
