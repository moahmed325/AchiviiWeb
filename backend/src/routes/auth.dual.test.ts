import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const updateMany = vi.fn();
const create = vi.fn();
const verifySupabaseToken = vi.fn();

vi.mock('../lib/prisma.js', () => ({ prisma: { user: { findUnique, updateMany, create } } }));
vi.mock('../lib/supabaseAuth.js', () => ({ verifySupabaseToken }));

describe('dual authentication identity resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps legacy JWT resolution unchanged', async () => {
    const { getAuthUser } = await import('./auth.js');
    findUnique.mockResolvedValueOnce({
      id: 'internal-1',
      email: 'user@example.com',
      timezone: 'UTC',
      created_at: new Date('2026-01-01'),
    });

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ userId: 'internal-1', email: 'user@example.com' })).toString('base64url');
    const secret = 'achivii-secret-key-development-only-2026';
    const signature = (await import('node:crypto')).createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    const req: any = { headers: { authorization: `Bearer ${header}.${body}.${signature}` } };

    await expect(getAuthUser(req)).resolves.toMatchObject({ id: 'internal-1' });
    expect(verifySupabaseToken).not.toHaveBeenCalled();
  });

  it('links a valid Supabase identity to the existing email without creating a user', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: 'USER@example.com' });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'internal-1',
      email: 'user@example.com',
      timezone: 'UTC',
      created_at: new Date('2026-01-01'),
      auth_user_id: null,
    });
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValueOnce({ id: 'internal-1', email: 'user@example.com', timezone: 'UTC', created_at: new Date('2026-01-01') });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser({ headers: { authorization: 'Bearer supabase-token' } } as any);

    expect(result?.id).toBe('internal-1');
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'internal-1', auth_user_id: null },
      data: { auth_user_id: 'auth-1' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('bootstraps a new internal user for an unlinked Supabase identity', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-new', email: 'new@example.com' });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    create.mockResolvedValue({
      id: 'internal-new',
      email: 'new@example.com',
      timezone: 'UTC',
      created_at: new Date('2026-01-01'),
    });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser({ headers: { authorization: 'Bearer supabase-token' } } as any);

    expect(result?.id).toBe('internal-new');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: { email: 'new@example.com', auth_user_id: 'auth-new' },
    }));
  });

  it('fails safely when the email is already linked to a different Supabase identity', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-2', email: 'user@example.com' });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'internal-1',
      email: 'user@example.com',
      timezone: 'UTC',
      created_at: new Date('2026-01-01'),
      auth_user_id: 'auth-1',
    });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser({ headers: { authorization: 'Bearer supabase-token' } } as any);

    expect(result).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
