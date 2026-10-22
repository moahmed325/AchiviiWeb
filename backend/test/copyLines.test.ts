import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import { sentenceReason } from '../src/lib/ai/weeklyUpdate.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';
import { AUTO_CLOSE_INSIGHT, MOVED_INSIGHT, NOT_OFFERED_WEEK_INSIGHT, PARTIAL_MOVE_INSIGHT } from '../src/lib/weekClose/close.js';
import { FINAL_WEEK_INSIGHT, KEEP_GOING_INSIGHT, WELCOME_BACK_INSIGHT } from '../src/lib/weekClose/breaks.js';
import {
  FALLBACK_HOLD_INSIGHT,
  kindWord,
  nextWeekSentence,
  RESTART_FALLBACK_BIG_WEEK_INSIGHT,
  RESTART_FALLBACK_INSIGHT,
  week12Sentence,
} from '../src/lib/weekClose/update.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';

// Weekly update M4.1a (WU-61 (2), RULE-7, section 6): every line code writes for the person passes the same copy check
// as the model's sentence, with sample amounts and dates filled in.

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
const fat = (value: number): WeekTarget => ({ kind: 'number', metric: 'Body fat', value, unit: 'percent', direction: 'lower_is_better' });
const fill = (line: string) => line.replace('{date}', 'January 14').replace('{n}', '7').replace('{w}', '8').replace('{level}', '12 km');

describe('code-written lines pass the copy check (M4.1a requirement 2)', () => {
  const lines: Record<string, string> = {
    AUTO_CLOSE_INSIGHT,
    MOVED_INSIGHT: fill(MOVED_INSIGHT),
    PARTIAL_MOVE_INSIGHT: fill(PARTIAL_MOVE_INSIGHT),
    NOT_OFFERED_WEEK_INSIGHT,
    WELCOME_BACK_INSIGHT: fill(WELCOME_BACK_INSIGHT),
    KEEP_GOING_INSIGHT: fill(KEEP_GOING_INSIGHT),
    FINAL_WEEK_INSIGHT: fill(FINAL_WEEK_INSIGHT),
    FALLBACK_HOLD_INSIGHT,
    RESTART_FALLBACK_INSIGHT: fill(RESTART_FALLBACK_INSIGHT),
    RESTART_FALLBACK_BIG_WEEK_INSIGHT: fill(RESTART_FALLBACK_BIG_WEEK_INSIGHT),
    'nextWeekSentence (higher is better)': nextWeekSentence(km(13.2)),
    'nextWeekSentence (lower is better)': nextWeekSentence(fat(21)),
    'week12Sentence (with the goal)': week12Sentence({ safe: '22 km', goal: '24 km' }),
    'week12Sentence (no goal)': week12Sentence({ safe: '22 km', goal: null }),
    "week12Sentence with next week held (WU-61 (3))": `${week12Sentence({ safe: '22 km', goal: '24 km' })} Next week stays at 20 km.`,
  };

  it.each(Object.entries(lines))('%s', (_name, line) => {
    expect(line).not.toMatch(/\{\w+\}/);
    expect(sentenceReason(line)).toBeNull();
  });

  it('the filled lines read as the copy table has them', () => {
    expect(lines['nextWeekSentence (lower is better)']).toBe('Next week aims at 21 percent or less, a safe step.');
    expect(lines.RESTART_FALLBACK_BIG_WEEK_INSIGHT).toBe('Week 8 picks up at 12 km.');
  });
});

describe('kind names in the sentence (M4.1a requirement 5, WU-61 (5), WU-11)', () => {
  // Only in-order kinds reach the sentence (`kindsOf`, from the handoff).
  const names = [...new Set(Object.values(RECOVERY_TEMPLATES).flatMap((profile) => profile.kinds.filter((kind) => kind.inOrder).map((kind) => kind.name)))];

  it('every in-order kind name of every template reads as a plain word in "catch up on {name}"', () => {
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) {
      const sentence = `Next week keeps this week's target, so you can catch up on ${kindWord(name)}.`;
      expect(sentenceReason(sentence), name).toBeNull();
      expect(kindWord(name)).toBe(kindWord(name).toLowerCase());
    }
  });

  it('the full list, name to what the sentence says', () => {
    expect(Object.fromEntries(names.map((name) => [name, kindWord(name)]))).toMatchInlineSnapshot(`
      {
        "Editing": "editing",
        "Filming": "filming",
        "Launch or shipping step": "launch or shipping steps",
        "New material": "new material",
        "New piece or section": "new pieces or sections",
        "New topic": "new topics",
        "Opening or theory study": "opening or theory study",
        "Outlining and planning": "outlining and planning",
        "Publishing": "publishing",
        "Research and scripting": "research and scripting",
        "Script and structure": "script and structure",
        "Strength workout": "strength workouts",
        "Titles and thumbnails": "titles and thumbnails",
      }
    `);
  });
});
