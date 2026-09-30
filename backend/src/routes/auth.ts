import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifySupabaseToken } from '../lib/supabaseAuth.js';

export const authRouter = Router();

type AuthenticatedUser = {
  id: string;
  email: string;
  timezone: string;
  created_at: Date;
};

const authUserSelect = {
  id: true,
  email: true,
  timezone: true,
  created_at: true,
} as const;

async function resolveSupabaseUser(
  authUserId: string,
  email: string | null,
): Promise<AuthenticatedUser | null> {
  const linked = await prisma.user.findUnique({
    where: { auth_user_id: authUserId },
    select: authUserSelect,
  });
  if (linked) return linked;

  const normalizedEmail = email?.toLowerCase().trim();
  if (!normalizedEmail) return null;

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { ...authUserSelect, auth_user_id: true },
  });

  if (existing) {
    if (existing.auth_user_id && existing.auth_user_id !== authUserId) {
      return null;
    }

    try {
      const linkedNow = await prisma.user.updateMany({
        where: { id: existing.id, auth_user_id: null },
        data: { auth_user_id: authUserId },
      });
      if (linkedNow.count === 1) {
        return await prisma.user.findUnique({
          where: { auth_user_id: authUserId },
          select: authUserSelect,
        });
      }

      const afterRace = await prisma.user.findUnique({
        where: { auth_user_id: authUserId },
        select: authUserSelect,
      });
      return afterRace ?? null;
    } catch {
      return null;
    }
  }

  try {
    return await prisma.user.create({
      data: {
        email: normalizedEmail,
        auth_user_id: authUserId,
      },
      select: authUserSelect,
    });
  } catch {
    const afterRace = await prisma.user.findUnique({
      where: { auth_user_id: authUserId },
      select: authUserSelect,
    });
    return afterRace ?? null;
  }
}

// Helper: Extract authenticated user from Authorization header
export async function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];

  const supabaseIdentity = await verifySupabaseToken(token);
  if (!supabaseIdentity) return null;

  try {
    return await resolveSupabaseUser(supabaseIdentity.authUserId, supabaseIdentity.email);
  } catch {
    return null;
  }
}

// GET /api/auth/me
authRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    console.error('Auth /me error:', error);
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});
