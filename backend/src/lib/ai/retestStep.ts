/**
 * Weekly update M3.3a (WU-55, WU-56): the re-test step code put first on a week's first offered practice day. No
 * weekly tests (2026-10-30): no re-test is written any more, but weeks stored before then can hold one, so the load
 * checks, the carry and the task rules still recognise it by its fixed text. Never change the text below.
 */
import type { DetailedStep } from './goalDecomposer.js';
import type { CodeMadeTest } from '../safety/weekLoad.js';

const RETEST_FOCUS = "Your honest best on last week's test, done exactly as written.";
const RETEST_PITFALL = 'Changing the test to make it easier.';
const EASY_RETEST = { title: 'Re-test: an easy version', focusCue: 'Easy and comfortable all the way through.' } as const;

/**
 * A stored re-test step, read from its fixed text: `measured` for the measured re-test, `light` for the easy one, null
 * for any other step. The load checks count it as the code-made test step of that kind.
 */
export function codeMadeRetestStep(step: Pick<DetailedStep, 'title' | 'focusCue' | 'pitfallToAvoid'>): CodeMadeTest {
  if (step.title === EASY_RETEST.title && step.focusCue === EASY_RETEST.focusCue) return 'light';
  return step.title.startsWith('Re-test: ') && step.focusCue === RETEST_FOCUS && step.pitfallToAvoid === RETEST_PITFALL ? 'measured' : null;
}
