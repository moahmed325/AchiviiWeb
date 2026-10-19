import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, PastLimitChoice, WeeklyTestResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { ApiError, logWeeklyTestResult } from '../../lib/api';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';
import { ReviewTestResultStep } from '../review/ReviewTestResultStep';
import { LightTestEntry } from '../review/LightTestEntry';
import { isLightTest, lightTestResult } from '../../lib/lightTest';
import { Button, Dialog, DialogContent, LoadingState, Surface } from '../ui';

// Weekly update M1.2b (RULE-8, WU-14, WU-28): what the app shows around an automatic week close.

export const GETTING_READY = 'Getting your next week ready…';
export const CLOSE_FAILED = "Couldn't get your next week ready. Please try again.";
const NOT_SAVED = "That didn't save. Please try again.";

/**
 * "Getting ready" (section 6): shown by every loading view while the close call writes the next week, in place of its
 * usual loading state. The skeleton's pulse stops under reduced motion (index.css).
 */
export const GettingReady: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label={GETTING_READY} showLabel />
  </main>
);

/**
 * The test first (WU-14): a close is due and the week's test isn't logged, so Today shows only this card. "Log result"
 * opens the test entry, and saving the result closes the week with it. Anything else is Skip and closes the week at
 * once as unlogged: "Skip" (on the card or the entry), dismissing the card, or going to another screen (AppShell).
 * Dismissing the entry goes back to the card (WU-32). Only the first answer sends a close (`answerHeldClose`). Closing
 * the tab answers nothing, so the card shows again on the next open.
 */
export const WeekTestFirst: React.FC<{ goal: Goal; weekNumber: number }> = ({ goal, weekNumber }) => {
  const { token } = useAuth();
  const { answerHeldClose } = useGoal();
  const week = goal.roadmapWeeks?.find((w) => w.weekNumber === weekNumber);
  const [entry, setEntry] = useState(false);
  const [result, setResult] = useState<WeeklyTestResult | null>(null);
  // M2.1: a light week's note; "I did it" logs it with the light result and closes the week.
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const light = isLightTest(week?.test);

  const skip = () => {
    if (!saving) void answerHeldClose();
  };
  // WU-32: Esc, the ✕ or a tap outside the entry goes back to the card; on the card itself it is Skip.
  const onOpenChange = (open: boolean) => {
    if (open || saving) return;
    if (entry) {
      setEntry(false);
      setError(null);
    } else {
      skip();
    }
  };

  const onSave = async () => {
    const toSave = light ? lightTestResult(note) : result;
    if (!toSave || !token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await answerHeldClose(async () => {
        try {
          await logWeeklyTestResult(weekNumber, toSave, token);
        } catch (err) {
          // Another tab closed the week meanwhile: nothing left to log, the close below finds nothing due.
          if (err instanceof ApiError && err.code === 'week_closed') return;
          throw err;
        }
      });
    } catch (err) {
      console.warn('Failed to log the test result:', err);
      setError(NOT_SAVED);
      setSaving(false);
    }
  };

  return (
    <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
      <Dialog open onOpenChange={onOpenChange}>
        {entry ? (
          <DialogContent
            title="Log last week's test"
            size="md"
            footer={
              <>
                <Button variant="quiet" onClick={skip} disabled={saving}>
                  Skip
                </Button>
                <Button variant="primary" onClick={onSave} disabled={(!light && !result) || !token} loading={saving}>
                  {light ? 'I did it' : 'Save result'}
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {light && week?.test ? (
                <LightTestEntry weekNumber={weekNumber} target={week.target} test={week.test} note={note} onNoteChange={setNote} disabled={saving} />
              ) : (
                <ReviewTestResultStep target={week?.target} test={week?.test} testResult={result} onChange={setResult} disabled={saving} />
              )}
              {error && (
                <p role="alert" className="text-small text-danger">
                  {error}
                </p>
              )}
            </div>
          </DialogContent>
        ) : (
          <DialogContent
            title="Did you do last week's test?"
            description="Log your result to shape next week."
            size="sm"
            footer={
              <>
                <Button variant="quiet" onClick={skip}>
                  Skip
                </Button>
                <Button variant="primary" onClick={() => setEntry(true)}>
                  Log result
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </main>
  );
};

/** Section 6 (WU-40 (3)): the card's words, by the choice the break waits for. */
const CHOICE_COPY: Record<PastLimitChoice, { body: string; action: string }> = {
  keep_going: {
    body: 'This break is longer than your plan can move. Start a fresh 12-week plan, or keep going with this one.',
    action: 'Keep going',
  },
  final_week: {
    body: "Your plan's dates have passed. Start a fresh 12-week plan, or do your final week now.",
    action: 'Do my final week',
  },
};

/**
 * Past the limit (M1.5b, RULE-15, WU-38, WU-40): Today shows only this card while the choice waits. "Keep going" or
 * "Do my final week" runs the close with that choice ("Getting your next week ready…" while it runs). "Start a fresh
 * plan" opens goal creation with the goal's text filled in, as switching goal does; nothing closes, and leaving goal
 * creation brings this card back. Closing the tab answers nothing.
 */
export const BreakChoice: React.FC<{ goal: Goal; choice: PastLimitChoice }> = ({ goal, choice }) => {
  const navigate = useNavigate();
  const { answerChoice } = useGoal();
  const [answering, setAnswering] = useState(false);
  const copy = CHOICE_COPY[choice];

  const keep = async () => {
    if (answering) return;
    setAnswering(true);
    try {
      await answerChoice(choice);
    } finally {
      setAnswering(false);
    }
  };

  const fresh = () => {
    // The way a goal switch opens goal creation (`usePathwayLaunch`): the draft key and `switchGoal`. WU-24: the text only.
    try {
      localStorage.setItem(DRAFT_GOAL_KEY, goal.rawGoal);
    } catch {
      // Without storage the navigation state still carries the text.
    }
    navigate('/onboarding', { state: { draftGoal: goal.rawGoal, isPreset: false, switchGoal: true } });
  };

  return (
    <main id="main" className="ui-root mx-auto flex w-full max-w-xl flex-1 items-center px-gutter py-10 sm:py-14">
      <Surface as="section" tone="elevated" padding="lg" aria-labelledby="break-choice-title" className="w-full">
        <h1 id="break-choice-title" className="text-h3 text-text">
          Welcome back.
        </h1>
        <p className="mt-3 text-body text-text-secondary">{copy.body}</p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={fresh} disabled={answering}>
            Start a fresh plan
          </Button>
          <Button variant="primary" onClick={keep} loading={answering}>
            {copy.action}
          </Button>
        </div>
      </Surface>
    </main>
  );
};
