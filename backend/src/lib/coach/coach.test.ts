import { describe, expect, it } from 'vitest';
import { CRISIS_REPLY, isCrisisMessage } from './crisis.js';
import { coachPrompt, COACH_SYSTEM } from './reply.js';
import { coachContext, type CoachGoal } from './context.js';

// ND-40: the coach's safety net, its prompt and what it knows about the plan.

describe('isCrisisMessage', () => {
  it('catches self-harm and suicide, however it is put', () => {
    for (const text of ['I want to kill myself', 'thinking about suicide', 'I keep hurting myself', 'no reason to live anymore', 'self-harm again', 'I want to end my life', 'I just want to die', "I don't want to be alive"])
      expect(isCrisisMessage(text)).toBe(true);
    expect(CRISIS_REPLY).toMatch(/emergency number/);
  });

  it('leaves ordinary practice talk alone', () => {
    for (const text of ['This run is killing me', 'My legs are dead after that', 'Can I end my session early?', "I'm ending my run at 3 km", "I'm going to die on these hill repeats", 'I hurt my knee'])
      expect(isCrisisMessage(text)).toBe(false);
  });
});

describe('the prompt', () => {
  it('holds the plan, the conversation oldest first, and the new message', () => {
    const prompt = coachPrompt('Their goal: X', [{ role: 'user', content: 'Hi' }, { role: 'coach', content: 'Hello!' }], 'What now?');
    expect(prompt.indexOf('PLAN')).toBeLessThan(prompt.indexOf('Them: Hi'));
    expect(prompt.indexOf('Them: Hi')).toBeLessThan(prompt.indexOf('You: Hello!'));
    expect(prompt).toContain('THEIR NEW MESSAGE\nWhat now?');
  });

  it('the coach never edits the plan, never diagnoses, and points to the app’s own controls', () => {
    expect(COACH_SYSTEM).toMatch(/You cannot edit the plan/);
    expect(COACH_SYSTEM).toMatch(/No medical/);
    expect(COACH_SYSTEM).toMatch(/Edit my schedule/);
  });
});

describe('coachContext', () => {
  const task = (over: Record<string, unknown>) => ({
    id: 't', goalId: 'g', weekNumber: 1, dayNumber: 1, dayOfWeek: 'Monday', title: 'Easy run', durationMinutes: 30,
    isRestDay: false, notOffered: false, status: 'pending', notes: null, feel: null, whyToday: null, ...over,
  });
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  const goal = {
    id: 'g', rawGoal: 'Run a 10K', status: 'active', currentWeek: 1, totalWeeks: 12, routine: JSON.stringify({ dailyMinutes: 45, preferredSlot: 'morning' }),
    startDate: new Date(daysAgo(3) + 'T00:00:00Z'), targetDate: new Date(Date.now() + 86 * 86_400_000),
    roadmap: { finalGoal: 'Run 10 km in under 50 minutes', method: { name: 'Jack Daniels VDOT', creator: 'Jack Daniels', summary: 'Paces from fitness.', rules: ['Most runs easy'] }, phases: [{ name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Build the base' }, { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'More' }] },
    roadmapWeeks: [{ weekNumber: 1, theme: 'Easy miles', objective: 'Run most days easy.' }],
    dailyTasks: [
      task({ date: daysAgo(3), status: 'completed', feel: 'too_hard', notes: 'Calves tight' }),
      task({ date: daysAgo(2), dayOfWeek: 'Tuesday' }),
      task({ date: daysAgo(1), dayOfWeek: 'Wednesday', isRestDay: true }),
      task({ date: today, dayOfWeek: 'Thursday', title: 'Strides', whyToday: 'Form work' }),
    ],
  } as unknown as CoachGoal;

  it('says the goal in the person’s words, the method, the phase, this week day by day, and the totals', () => {
    const text = coachContext(goal, 'Mo', 'UTC');
    expect(text).toContain('Their goal, in their words: "Run a 10K"');
    expect(text).toContain('Method: Jack Daniels VDOT (Jack Daniels)');
    expect(text).toContain('Current phase: Foundation (weeks 1-4)');
    expect(text).toContain('Next phase: Build, from week 5.');
    expect(text).toContain('day 4 today, week 1 of 12');
    expect(text).toMatch(/Easy run · 30 min · done · felt too hard · their note: "Calves tight"/);
    expect(text).toMatch(/Tuesday .*: Easy run · 30 min · missed/);
    expect(text).toMatch(/Wednesday .*: rest · rest day/);
    expect(text).toContain("Today's session: Strides (30 min). Why today: Form work.");
    expect(text).toContain('1 sessions done, 1 practice days missed, current streak 0');
    expect(text).toContain('about 45 minutes a practice day, usually in the morning');
  });
});
