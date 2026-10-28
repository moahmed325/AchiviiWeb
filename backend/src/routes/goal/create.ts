// B-102: goal clarify and goal creation, moved out of routes/goal.ts unchanged (a pure move).
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getAuthUser } from '../auth.js';
import { normalizeTimezone, resolveGoalStart } from '../../lib/timezone.js';
import { authorizeNewCustomGoal, authorizeNextPlan } from '../../lib/billing/goalAuthorization.js';
import { journeyResultOf, journeySummary, NEXT_PLAN_MODES, nextPlanStart, readPreviousPlan, type NextPlanMode, type PreviousPlan } from '../../lib/nextPlan.js';
import { clarifyGoalWithAI, UserRoutineInput } from '../../lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../../lib/ai/presets/index.js';
import { isHighLoadGoal } from '../../lib/highLoad.js';
import { loadGoalInput } from '../../lib/safety/stepLoad.js';
import { logRoadmapTargets } from '../../lib/safety/targetSteps.js';
import { generateRoadmap, lightTestSession, TOTAL_WEEKS, type PlanAnswer, type Roadmap } from '../../lib/ai/roadmap.js';
import { activeDaysFor, generateWeekPlan, slotTimeFor, type PlanVariant, type WeekDayPlan } from '../../lib/ai/weekPlan.js';
import { dailyTaskRows, roadmapWeekRows, storedRoadmap } from '../../lib/planV2.js';
import { makeGoalProfile } from '../../lib/recovery/forGoal.js';
import { customProfilesEnabled, generateRecoveryProfile } from '../../lib/recovery/profileCall.js';
import type { RecoveryProfile } from '../../lib/recovery/profile.js';
import { logSafetyHit, type SafetyLogLine } from '../../lib/ai/safetyScan.js';
import { byIp, byTokenOrIp, routeLimit } from '../../lib/rateLimit.js';
import { wantsPlanStream, openPlanStream, journeyGoalOf, presentGoal } from './present.js';

export const createRoutes = Router();

export function planAnswerList(list: unknown, byQuestion: unknown): PlanAnswer[] {
  if (Array.isArray(list)) {
    const cleaned = list
      .map((item) => ({
        id: typeof item?.id === 'string' ? item.id : '',
        question: typeof item?.question === 'string' ? item.question : '',
        answer: typeof item?.answer === 'string' ? item.answer : '',
      }))
      .filter((item) => item.question || item.id);
    if (cleaned.length > 0) return cleaned;
  }
  if (byQuestion && typeof byQuestion === 'object') {
    return Object.entries(byQuestion as Record<string, unknown>).map(([question, answer]) => ({
      id: '',
      question,
      answer: typeof answer === 'string' ? answer : '',
    }));
  }
  return [];
}

export type NextPlanRequest =
  | { start: NonNullable<ReturnType<typeof nextPlanStart>>; previousPlan: PreviousPlan }
  | { status: number; error: string; code?: string };

/**
 * Next plan (NP-7 to NP-10): `nextPlan` on `POST /api/goal/create` (`{ fromGoalId, mode, level? }`). Null when the
 * body has none. Pro for every goal. The level comes from the old plan's stored results (NP-8); only a level the
 * person typed (after a break, or with no result logged) is taken from the body. "Keep going" and "Go further" follow
 * a completed plan, "Start a fresh plan" the active one (a long break, WU-9).
 */
export async function readNextPlanRequest(userId: string, body: unknown): Promise<NextPlanRequest | null> {
  if (body === undefined || body === null) return null;
  const request = body as { fromGoalId?: unknown; mode?: unknown; level?: unknown };
  const mode = request.mode as NextPlanMode;
  const level = request.level === undefined || request.level === null ? null : request.level;
  if (
    typeof body !== 'object' ||
    typeof request.fromGoalId !== 'string' ||
    !NEXT_PLAN_MODES.includes(mode) ||
    (level !== null && (typeof level !== 'number' || !Number.isFinite(level) || level < 0))
  ) {
    return { status: 400, error: 'nextPlan must name the plan it follows and how it continues.' };
  }
  const authorization = await authorizeNextPlan(userId);
  if (!authorization.allowed) return { status: 403, error: authorization.message, code: authorization.code };

  const old = await prisma.goal.findFirst({
    where: { id: request.fromGoalId, userId },
    include: { roadmapWeeks: { orderBy: { weekNumber: 'asc' } } },
  });
  if (!old) return { status: 404, error: 'That plan was not found.' };
  if (old.status !== (mode === 'fresh' ? 'active' : 'completed')) {
    return { status: 409, error: 'This plan can no longer be continued this way.' };
  }
  const result = journeyResultOf(journeyGoalOf(old as unknown as Record<string, unknown>));
  if (!result) return { status: 409, error: 'This plan can no longer be continued this way.' };
  const start = nextPlanStart(result, mode, level as number | null);
  if (!start) return { status: 400, error: 'Tell us where you are now, so your next plan starts there.' };
  return {
    start,
    previousPlan: { goalId: old.id, number: (readPreviousPlan(old.roadmap)?.number ?? 1) + 1, mode, summary: journeySummary(result) },
  };
}

/**
 * B-106: the goal's optional fixed date (an exam, a race, a talk), sent as `fixedDate` (`YYYY-MM-DD`, the person's
 * local date). Stored like `startDate` (ND-1: that date at 00:00 UTC). It must be after the start date; it may be less
 * than 90 days away (the plan stays 90 days and only never moves past it). Absent, null or '' is no date. A next plan
 * carries nothing itself: the app fills the old plan's date in the field, so what the person sees is what is saved.
 */
export function readFixedDate(value: unknown, start: Date): { date: Date | null } | { error: string } {
  if (value === undefined || value === null || value === '') return { date: null };
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
  if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { error: 'Choose a real date for your fixed date, or leave it empty.' };
  }
  if (date.getTime() <= start.getTime()) return { error: 'Your fixed date needs to be after the day your plan starts.' };
  return { date };
}

export async function saveV2Goal(input: {
  userId: string;
  rawGoal: string;
  roadmap: Roadmap;
  week1: WeekDayPlan[];
  answers: Record<string, string>;
  answerList: PlanAnswer[];
  routine: UserRoutineInput;
  start: Date;
  targetDate: Date;
  /** B-106: the outside date the plan never moves past, or null. */
  fixedDate?: Date | null;
  isPreset: boolean;
  /** Method-aware recovery (M1.3a): saved under `recovery` when it passed the checks. */
  recovery?: RecoveryProfile | null;
  /** Next plan (NP-8): the plan this one follows, saved under `previousPlan`. */
  previousPlan?: PreviousPlan | null;
}): Promise<string> {
  const { roadmap } = input;
  const stored = storedRoadmap(roadmap, input.answerList, input.recovery);
  // One transaction (B-100): a failed write must not archive the person's current goal and leave a half-saved new one.
  return prisma.$transaction(async (tx) => {
    await tx.goal.updateMany({ where: { userId: input.userId, status: 'active' }, data: { status: 'archived' } });
    const goal = await tx.goal.create({
      data: {
        userId: input.userId,
        rawGoal: input.rawGoal,
        clarifiedOutcome: roadmap.finalGoal,
        methodologyNotes: `${roadmap.method.name}: ${roadmap.method.summary}`,
        status: 'active',
        startDate: input.start,
        targetDate: input.targetDate,
        fixedDate: input.fixedDate ?? null,
        currentWeek: 1,
        answers: JSON.stringify(input.answers),
        routine: JSON.stringify(input.routine),
        isGoldenRail: input.isPreset,
        canonicalMethodName: roadmap.method.name,
        canonicalAuthority: roadmap.method.creator || null,
        planVersion: 2,
        roadmap: JSON.parse(JSON.stringify(input.previousPlan ? { ...stored, previousPlan: input.previousPlan } : stored)),
      },
    });
    await tx.roadmapWeek.createMany({
      data: roadmapWeekRows(goal.id, roadmap, input.routine.dailyMinutes!, input.routine.planVariant as PlanVariant),
    });
    await tx.dailyTask.createMany({ data: dailyTaskRows(goal.id, 1, input.week1) });
    return goal.id;
  });
}

/**
 * Method-aware recovery (RULE-2 to RULE-4): the profile a new goal is saved with, made after the roadmap and before
 * week 1. A pathway gets its own profile. A custom goal gets the profile call when `CUSTOM_RECOVERY_PROFILES_ENABLED`
 * is on (M1.3b), otherwise its keyword template unchanged (MR-14). Pathway and template profiles are checked without
 * the deliverable fact (MR-22). Null when it fails (logged; the goal is then saved without one, RULE-18). Never throws.
 */
export async function recoveryProfileAtCreate(input: {
  presetId?: string;
  domain: string | null;
  goalText: string;
  answers: PlanAnswer[];
  roadmap: Roadmap;
}): Promise<RecoveryProfile | null> {
  const keywordProfile = () => {
    const result = makeGoalProfile({ presetId: input.presetId, domain: input.domain, goalText: input.goalText, methodName: input.roadmap.method?.name });
    if ('profile' in result) return result.profile;
    console.warn('[Recovery] No profile saved at goal create:', result.reasons);
    return null;
  };
  try {
    if (input.presetId || !customProfilesEnabled()) return keywordProfile();
    try {
      const { method, phases, weeks } = input.roadmap;
      const result = await generateRecoveryProfile({
        goalText: input.goalText,
        domain: input.domain,
        answers: input.answers,
        method: { name: method.name, summary: method.summary, rules: method.rules },
        phases,
        weeklyTargets: [...weeks].sort((a, b) => a.weekNumber - b.weekNumber).map((week) => week.target),
      });
      if (result.source !== 'model') console.warn('[Recovery] Profile call fell back to a template:', result.source);
      return result.profile;
    } catch (err) {
      console.warn('[Recovery] Profile call failed at goal create:', err);
      return keywordProfile();
    }
  } catch (err) {
    console.warn('[Recovery] Could not make a profile at goal create:', err);
  }
  return null;
}



/**
 * POST /api/goal/clarify
 * Analyzes raw goal, formulates clarified outcome, domain frameworks, and tailored questions.
 */
// B-99 (6): clarify needs no sign-in and calls the model, so it is limited per IP; create, per signed-in token.
createRoutes.post('/clarify', routeLimit({ windowMs: 60_000, max: 10, keyOf: byIp }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawGoal } = req.body;
    if (!rawGoal || typeof rawGoal !== 'string' || !rawGoal.trim()) {
      res.status(400).json({ error: 'Please provide a valid goal description.' });
      return;
    }

    const clarification = await clarifyGoalWithAI(rawGoal.trim());
    res.json(clarification);
  } catch (err: any) {
    console.error('[GoalRouter] Clarification error:', err);
    res.status(503).json({ error: err.message || "Couldn't generate your plan right now. AI services are temporarily unavailable. Please retry." });
  }
});

/**
 * POST /api/goal/create
 * Creates the goal, 12-week roadmap, and Week 1 daily tasks.
 */
createRoutes.post('/create', routeLimit({ windowMs: 10 * 60_000, max: 10, keyOf: byTokenOrIp }), async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      return;
    }

    const { rawGoal, clarifiedOutcome, answers, routine, startDate, domain } = req.body;

    // A preset/certified pathway is determined by the same server-side preset resolver used below.
    // New non-preset goals require a verified Pro entitlement before any plan generation or mutation.
    const requestedPreset = typeof rawGoal === 'string' ? findPresetForGoal(rawGoal) : null;
    const requestedClarifiedPreset = typeof clarifiedOutcome === 'string' ? findPresetForGoal(clarifiedOutcome) : null;
    // Next plan (NP-7): its own Pro check covers custom goals too.
    const nextPlan = await readNextPlanRequest(user.id, req.body?.nextPlan);
    if (nextPlan && 'error' in nextPlan) {
      res.status(nextPlan.status).json({ error: nextPlan.error, ...(nextPlan.code ? { code: nextPlan.code } : {}) });
      return;
    }
    if (!nextPlan && !requestedPreset && !requestedClarifiedPreset) {
      const authorization = await authorizeNewCustomGoal(user.id);
      if (!authorization.allowed) {
        res.status(403).json({ error: authorization.message, code: authorization.code });
        return;
      }
    }

    if (!rawGoal || !clarifiedOutcome) {
      res.status(400).json({ error: 'Goal and clarified outcome are required.' });
      return;
    }
    const dailyMinutes = Number(routine?.dailyMinutes);
    if (!Number.isFinite(dailyMinutes) || dailyMinutes < 10 || dailyMinutes > 480) {
      res.status(400).json({ error: 'Choose how many minutes a day you can practise.' });
      return;
    }
    if (!['steady', 'accelerated', 'minimal'].includes(routine?.planVariant)) {
      res.status(400).json({ error: 'Choose how many days a week you can practise.' });
      return;
    }

    // ND-1: the goal starts on the user's local calendar day, stored as that date at 00:00 UTC.
    const start = resolveGoalStart(normalizeTimezone(user.timezone), startDate);
    const targetDate = new Date(start);
    targetDate.setUTCDate(targetDate.getUTCDate() + 90);
    const fixed = readFixedDate(req.body?.fixedDate, start);
    if ('error' in fixed) {
      res.status(400).json({ error: fixed.error });
      return;
    }

    const routineInput: UserRoutineInput = {
      wakeTime: routine?.wakeTime || '07:00',
      sleepTime: routine?.sleepTime || '23:00',
      busyHours: routine?.busyHours || '09:00 - 17:00',
      preferredSlot: routine?.preferredSlot || 'evening',
      dailyMinutes,
      planVariant: routine.planVariant,
      commitments: routine?.commitments || []
    };

    const startedAt = Date.now();
    const stream = wantsPlanStream(req);
    const send = stream ? openPlanStream(res, startedAt) : null;
    const fail = (status: number, error: string) => {
      if (send) {
        send({ type: 'error', error });
        res.end();
        return;
      }
      res.status(status).json({ error });
    };

    const planVariant = routineInput.planVariant as PlanVariant;
    // NP-3: a next plan adds the level it starts from as one more answer, in place of any sent with that id.
    const sentAnswers = planAnswerList(req.body.answerList, answers);
    const measuredLevel = nextPlan ? nextPlan.start.answer : null;
    const answerList = measuredLevel ? [...sentAnswers.filter((item) => item.id !== measuredLevel.id), measuredLevel] : sentAnswers;
    const answerRecord: Record<string, string> = {
      ...(answers && typeof answers === 'object' ? answers : {}),
      ...(measuredLevel ? { [measuredLevel.question]: measuredLevel.answer } : {}),
    };
    const measuredStart = nextPlan && nextPlan.start.value !== null && nextPlan.start.unit ? { value: nextPlan.start.value, unit: nextPlan.start.unit } : null;
    const preset = findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome);
    send?.({
      type: 'step',
      id: 'search',
      label: preset ? 'Using a proven method for this goal' : 'Comparing methods for your answers',
    });

    const roadmapResult = await generateRoadmap({
      workingTitle: clarifiedOutcome,
      domain: typeof domain === 'string' && domain.trim() ? domain.trim() : preset?.primaryDomain || clarifiedOutcome,
      rawGoal,
      dailyMinutes,
      activeDays: activeDaysFor(planVariant),
      answers: answerList,
      ...(measuredStart ? { measuredStart } : {}),
    });

    let week1: WeekDayPlan[] | null = null;
    // B-91: week 1's `[Safety]` lines wait for the goal id, and are logged once the goal is saved (or without it if not).
    const week1SafetyLines: SafetyLogLine[] = [];
    let recovery: RecoveryProfile | null = null;
    if (roadmapResult.ok) {
      const { roadmap } = roadmapResult;
      send?.({ type: 'step', id: 'method', label: roadmap.method.name, detail: roadmap.method.whyChosen });
      send?.({ type: 'step', id: 'plan', label: 'Writing your first week' });
      // Before week 1, so the week call can use the kinds (M2.1). No stream event of its own.
      recovery = await recoveryProfileAtCreate({
        presetId: preset?.id,
        domain: typeof domain === 'string' ? domain : null,
        goalText: `${rawGoal} ${clarifiedOutcome}`,
        answers: answerList,
        roadmap,
      });
      const first = roadmap.weeks[0];
      const firstSession = lightTestSession(first.test, rawGoal, clarifiedOutcome);
      week1 = await generateWeekPlan({
        finalGoal: roadmap.finalGoal,
        answers: answerList,
        dailyMinutes,
        planVariant,
        slotTime: slotTimeFor(routineInput.preferredSlot),
        method: roadmap.method,
        weekNumber: 1,
        totalWeeks: TOTAL_WEEKS,
        phase: roadmap.phases[0],
        focus: first.focus,
        target: first.target,
        test: first.test,
        weekStart: start,
        // M2.1 (WU-43 (5)): only a light first week names the session its test belongs to.
        ...(firstSession ? { testSession: firstSession } : {}),
        highLoadGoal: isHighLoadGoal({ rawGoal, clarifiedOutcome }),
        // Plan safety limits M2.1 (RULE-4): only a load goal adds the key.
        ...loadGoalInput({ rawGoal, clarifiedOutcome }, first.target),
        recovery,
        heldSafetyLines: week1SafetyLines,
      });
    }

    let createdGoalId: string;
    if (roadmapResult.ok && week1) {
      createdGoalId = await saveV2Goal({
        userId: user.id,
        rawGoal,
        roadmap: roadmapResult.roadmap,
        week1,
        answers: answerRecord,
        answerList,
        routine: routineInput,
        start,
        targetDate,
        fixedDate: fixed.date,
        isPreset: Boolean(preset),
        recovery,
        previousPlan: nextPlan ? nextPlan.previousPlan : null,
      });
      // Plan safety limits M1.2 (RULE-10, AC-10): the accepted roadmap's lowered targets, logged once with the goal id.
      // The check's own decision (family, no start, pathway), so the log and the check can never disagree.
      logRoadmapTargets(createdGoalId, roadmapResult.roadmap, roadmapResult.targetCheck);
      for (const line of week1SafetyLines) logSafetyHit({ ...line, goalId: createdGoalId });
    } else {
      for (const line of week1SafetyLines) logSafetyHit(line);
      // No silent v1 fallback, for presets either: a plan the AI could not write is an honest "try again", never an
      // old-style plan without the plan v2 features (missed sessions, weekly targets). Logged so a missing or broken
      // AI key shows up in the logs.
      console.warn('[GoalRouter] Plan v2 could not be written:', roadmapResult.ok ? 'week 1 failed' : roadmapResult.reason);
      if (!roadmapResult.ok) fail(roadmapResult.unsafe || roadmapResult.lowSafety ? 422 : 503, roadmapResult.reason);
      else fail(503, "Couldn't write your first week right now. Please try again.");
      return;
    }

    const saved = await prisma.goal.findUniqueOrThrow({
      where: { id: createdGoalId },
      include: {
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        dailyTasks: { orderBy: { dayNumber: 'asc' } },
        weeklyReviews: { orderBy: { weekNumber: 'asc' } }
      }
    });
    const presented = presentGoal(saved as unknown as Record<string, unknown>);
    const body = {
      goal: presented,
      // M1.3 review: the same weeks the goal carries, never a second, unlowered copy.
      roadmapWeeks: presented.roadmapWeeks,
      dailyTasks: saved.dailyTasks,
    };
    if (send) {
      send({ type: 'done', ...body });
      res.end();
      return;
    }
    res.status(201).json(body);
  } catch (err: any) {
    console.error('[GoalRouter] Create goal error:', err);
    const error = err.message || "Couldn't generate your plan right now. Please try again.";
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
      res.end();
      return;
    }
    res.status(503).json({ error });
  }
});
