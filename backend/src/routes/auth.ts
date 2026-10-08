import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifySupabaseToken } from '../lib/supabaseAuth.js';
import { isValidTimezone } from '../lib/timezone.js';

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

/** The default every user starts with (schema.prisma), and the zones that mean the same thing. */
const DEFAULT_TIMEZONE = 'UTC';
const UTC_ALIASES = /^(Etc\/)?(UTC|GMT|Universal|Zulu|UCT)$/i;

/** A timezone worth storing: a valid IANA name that is not UTC itself. Anything else is ignored. */
function usableTimezone(value: unknown): string | null {
  const zone = Array.isArray(value) ? value[0] : value;
  if (typeof zone !== 'string') return null;
  const trimmed = zone.trim();
  return trimmed && !UTC_ALIASES.test(trimmed) && isValidTimezone(trimmed) ? trimmed : null;
}

/**
 * Every date in the app is the user's local calendar date (missed sessions ND-1), so a user left on the default UTC
 * gets the wrong "today" and the wrong day close. When the stored zone is still that default, take the browser's zone
 * (X-Client-Timezone) or the one sent at sign-up, once. A zone already set is never changed here, so travelling never
 * moves anyone's days (Feature Definition section 10).
 */
async function correctDefaultTimezone(
  user: AuthenticatedUser,
  ...candidates: unknown[]
): Promise<AuthenticatedUser> {
  if (user.timezone !== DEFAULT_TIMEZONE) return user;
  const zone = candidates.map(usableTimezone).find((value): value is string => value !== null);
  if (!zone) return user;
  try {
    // Only while it is still the default, so two requests at once cannot overwrite each other.
    await prisma.user.updateMany({ where: { id: user.id, timezone: DEFAULT_TIMEZONE }, data: { timezone: zone } });
    return { ...user, timezone: zone };
  } catch {
    return user;
  }
}

async function resolveSupabaseUser(
  authUserId: string,
  email: string | null,
  signupTimezone?: string,
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
        // The zone the browser reported at sign-up; without a usable one the schema default (UTC) applies.
        ...(usableTimezone(signupTimezone) ? { timezone: usableTimezone(signupTimezone)! } : {}),
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
    const user = await resolveSupabaseUser(supabaseIdentity.authUserId, supabaseIdentity.email, supabaseIdentity.timezone);
    if (!user) return null;
    return await correctDefaultTimezone(user, req.headers['x-client-timezone'], supabaseIdentity.timezone);
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
