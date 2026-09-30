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

afterEach(() => {
  cleanup();
});
