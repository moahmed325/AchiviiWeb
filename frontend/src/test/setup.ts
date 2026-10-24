import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: localStorage.getItem('achivii_auth_token')
            ? { access_token: localStorage.getItem('achivii_auth_token') }
            : null,
        },
      })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(async () => ({
        data: { session: { access_token: 'test-token' } },
        error: null,
      })),
      signUp: vi.fn(async () => ({
        data: { session: { access_token: 'test-token' } },
        error: null,
      })),
      signOut: vi.fn(async () => undefined),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ data: { user: {} }, error: null })),
    },
  },
}));
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement scrolling or media queries.
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

// B-70: a call no test mocked fails at once, loudly, instead of reaching a dev server on :5000.
// Tests that need fetch replace it (vi.stubGlobal / vi.spyOn); this is only the fallback.
globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  console.error(`[test] unmocked fetch: ${url}`);
  throw new TypeError(`Unmocked fetch in a test: ${url}`);
}) as typeof fetch;

afterEach(() => {
  cleanup();
});
