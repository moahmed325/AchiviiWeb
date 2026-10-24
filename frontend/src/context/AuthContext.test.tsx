import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import * as api from '../lib/api';
import { ACCOUNT_LOAD_FAILED, describeAuthError } from '../lib/authFlow';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/api', async (importOriginal) => ({
  ApiError: (await importOriginal<typeof import('../lib/api')>()).ApiError,
  fetchCurrentUser: vi.fn(),
}));

const mocked = vi.mocked(api);

/** Runs `action` with the context once it has loaded, and returns what it threw. */
async function errorFrom(action: 'login' | 'signup'): Promise<unknown> {
  let auth: ReturnType<typeof useAuth> | null = null;
  function Probe() {
    auth = useAuth();
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => expect(auth?.loading).toBe(false));
  try {
    await auth![action]('a@b.com', 'secret-pass');
  } catch (error) {
    return error;
  }
  return null;
}

describe('sign-in when /api/auth/me fails (B-44)', () => {
  it.each(['login', 'signup'] as const)('%s: a 401 from /me is not read as a wrong password', async (action) => {
    mocked.fetchCurrentUser.mockRejectedValue(new api.ApiError('Failed to authenticate', 401));
    const error = await errorFrom(action);
    expect(error).toBeInstanceOf(Error);
    expect(describeAuthError(error)).toEqual({ kind: 'server', message: ACCOUNT_LOAD_FAILED });
  });

  it('a lost connection still reads as offline', async () => {
    mocked.fetchCurrentUser.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(describeAuthError(await errorFrom('login')).kind).toBe('offline');
  });
});

describe('fetchCurrentUser (B-44)', () => {
  it('turns an HTML 502 page into an ApiError, not a JSON parse error', async () => {
    const { fetchCurrentUser, ApiError } = await vi.importActual<typeof import('../lib/api')>('../lib/api');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(fetchCurrentUser('t')).rejects.toBeInstanceOf(ApiError);
    await expect(fetchCurrentUser('t')).rejects.toMatchObject({ status: 502, message: 'Failed to authenticate' });
    vi.unstubAllGlobals();
  });
});
