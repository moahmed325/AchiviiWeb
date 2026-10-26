import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifySupabaseToken } from '../lib/supabaseAuth.js';
import { isValidTimezone } from '../lib/timezone.js';
import { remindersLive } from '../lib/reminders/email.js';
import { UnauthorizedError, ValidationError } from '../lib/httpErrors.js';

export const authRouter = Router();

type AuthenticatedUser = {
  id: string;
  email: string;
  timezone: string;
  created_at: Date;
  remindersEnabled: boolean;
};

const authUserSelect = {
  id: true,
  email: true,
  timezone: true,
  created_at: true,
  remindersEnabled: true,
} as const;

/** The user as the app gets it: ND-26 adds whether reminder emails are being sent at all, so Account shows the
 * setting only then. */
function presentUser<T extends object>(user: T): T & { remindersAvailable: boolean } {
  return { ...user, remindersAvailable: remindersLive() };
}

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

/**
 * B-105: first sign-in only. A user row made before Supabase (found by email) is linked to this Supabase account once;
 * a row already linked to another account is never taken over. Per-request auth reaches this only when the account
 * has no linked row yet.
 */
async function linkByEmail(existing: { id: string; auth_user_id: string | null }, authUserId: string): Promise<AuthenticatedUser | null> {
  if (existing.auth_user_id && existing.auth_user_id !== authUserId) return null;
  try {
    // A conditional update decides a race between two first requests; the loser reads the winner's link.
    await prisma.user.updateMany({ where: { id: existing.id, auth_user_id: null }, data: { auth_user_id: authUserId } });
    return await prisma.user.findUnique({ where: { auth_user_id: authUserId }, select: authUserSelect });
  } catch {
    return null;
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

  if (existing) return linkByEmail(existing, authUserId);

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

    res.status(200).json({ user: presentUser(user) });
  } catch (error: any) {
    console.error('Auth /me error:', error);
    res.status(500).json({ error: 'Failed to authenticate user.' });
  }
});

// PUT /api/auth/timezone: B-46 (2), Travelling Leo. A person who moved keeps the zone set at sign-up until they choose
// the device's zone here (the account menu offers it when the two differ). Stored dates stay calendar days; only when
// "today" rolls over changes.
authRouter.put('/timezone', async (req: Request, res: Response): Promise<void> => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized. Please sign in.' });
    return;
  }
  const zone = typeof req.body?.timezone === 'string' ? req.body.timezone.trim() : '';
  if (!zone || !isValidTimezone(zone)) {
    res.status(400).json({ error: 'That time zone is not recognised.' });
    return;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { timezone: zone }, select: authUserSelect });
  res.status(200).json({ user: presentUser(updated) });
});

// PUT /api/auth/reminders: ND-26, the missed-day reminder email on or off (Account). The email's own unsubscribe link
// turns it off without signing in (`routes/reminders.ts`).
authRouter.put('/reminders', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) throw new UnauthorizedError();
    const enabled = req.body?.enabled;
    if (typeof enabled !== 'boolean') throw new ValidationError('enabled must be true or false.');
    const updated = await prisma.user.update({ where: { id: user.id }, data: { remindersEnabled: enabled }, select: authUserSelect });
    res.status(200).json({ user: presentUser(updated) });
  } catch (err) {
    next(err);
  }
});
