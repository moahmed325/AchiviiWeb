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
