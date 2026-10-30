import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

import { AUTO_CLOSE_INSIGHT, MOVED_INSIGHT, NOT_OFFERED_WEEK_INSIGHT, PARTIAL_MOVE_INSIGHT } from '../src/lib/weekClose/close.js';
import { FINAL_WEEK_INSIGHT, KEEP_GOING_INSIGHT, WELCOME_BACK_INSIGHT } from '../src/lib/weekClose/breaks.js';
import { FIRST_WEEK_BACK_LINE } from '../src/lib/recovery/easyStart.js';

// Weekly update section 6 (WU-62 (4)): every line code writes for the person, word for word. No weekly tests
// (2026-10-30): the target lines and the test steps went with the weekly update.

describe("section 6's rows match the code word for word", () => {
  it('the server lines', () => {
    expect(AUTO_CLOSE_INSIGHT).toBe('Next week is ready.');
    expect(MOVED_INSIGHT).toBe('Your next week starts today. Your plan now ends on {date}.');
    expect(PARTIAL_MOVE_INSIGHT).toBe('Your plan now ends on {date}.');
    expect(NOT_OFFERED_WEEK_INSIGHT).toBe('No practice days were offered this week.');
    expect(WELCOME_BACK_INSIGHT).toBe('Welcome back. Your plan picks up from here and now ends on {date}.');
    expect(KEEP_GOING_INSIGHT).toBe('Welcome back. Your plan picks up at week {n} and now ends on {date}.');
    expect(FINAL_WEEK_INSIGHT).toBe('Welcome back. Your final week starts today and ends on {date}.');
  });

  it('the step text code writes', () => {
    expect(FIRST_WEEK_BACK_LINE).toBe('First week back: keep the effort easy today.');
  });
});
