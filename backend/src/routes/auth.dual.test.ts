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

describe('user timezone (missed sessions ND-1)', () => {
  const linkedUser = (timezone: string) => ({ id: 'internal-1', email: 'user@example.com', timezone, created_at: new Date('2026-01-01') });
  const request = (clientTimezone?: string) =>
    ({ headers: { authorization: 'Bearer supabase-token', ...(clientTimezone ? { 'x-client-timezone': clientTimezone } : {}) } }) as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the zone sent at sign-up on a new user', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-new', email: 'new@example.com', timezone: 'Africa/Nairobi' });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 'internal-new', email: 'new@example.com', timezone: 'Africa/Nairobi', created_at: new Date() });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser(request());

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: { email: 'new@example.com', auth_user_id: 'auth-new', timezone: 'Africa/Nairobi' },
    }));
    expect(result?.timezone).toBe('Africa/Nairobi');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('ignores an invalid sign-up zone and keeps the default', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-new', email: 'new@example.com', timezone: 'Mars/Olympus' });
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    create.mockResolvedValue({ id: 'internal-new', email: 'new@example.com', timezone: 'UTC', created_at: new Date() });

    const { getAuthUser } = await import('./auth.js');
    await getAuthUser(request());

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: { email: 'new@example.com', auth_user_id: 'auth-new' } }));
  });

  it('corrects a user still on the default UTC from the browser zone, once and only while still UTC', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: 'user@example.com' });
    findUnique.mockResolvedValueOnce(linkedUser('UTC'));
    updateMany.mockResolvedValue({ count: 1 });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser(request('America/New_York'));

    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'internal-1', timezone: 'UTC' }, data: { timezone: 'America/New_York' } });
    expect(result?.timezone).toBe('America/New_York');
  });

  it('falls back to the sign-up zone when the browser sends none', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: 'user@example.com', timezone: 'Asia/Tokyo' });
    findUnique.mockResolvedValueOnce(linkedUser('UTC'));
    updateMany.mockResolvedValue({ count: 1 });

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser(request());

    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'internal-1', timezone: 'UTC' }, data: { timezone: 'Asia/Tokyo' } });
    expect(result?.timezone).toBe('Asia/Tokyo');
  });

  it('never changes a zone that is already set (travel does not move anyone\'s days)', async () => {
    verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: 'user@example.com', timezone: 'Africa/Nairobi' });
    findUnique.mockResolvedValueOnce(linkedUser('America/Los_Angeles'));

    const { getAuthUser } = await import('./auth.js');
    const result = await getAuthUser(request('Europe/Paris'));

    expect(updateMany).not.toHaveBeenCalled();
    expect(result?.timezone).toBe('America/Los_Angeles');
  });

  it('treats UTC aliases and invalid zones from the browser as nothing to correct', async () => {
    const { getAuthUser } = await import('./auth.js');
    for (const zone of ['UTC', 'Etc/UTC', 'GMT', 'Not/AZone', '']) {
      verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: 'user@example.com' });
      findUnique.mockResolvedValueOnce(linkedUser('UTC'));
      const result = await getAuthUser(request(zone));
      expect(result?.timezone, zone).toBe('UTC');
    }
    expect(updateMany).not.toHaveBeenCalled();
  });
});
