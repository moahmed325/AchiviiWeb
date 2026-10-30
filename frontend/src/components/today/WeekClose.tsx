import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Goal, PastLimitChoice } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';
import { Button, LoadingState, Surface } from '../ui';
import { needsLevel } from '../../lib/nextPlan';
import { useProEntitlement } from '../../hooks/useProEntitlement';
import { NextPlanLevelDialog } from '../achievement/NextPlanLevelDialog';
import { fixedDateKey } from '../../lib/fixedDate';
import { useNextPlanLaunch } from '../achievement/useNextPlanLaunch';

// Weekly update M1.2b (RULE-8, WU-28): what the app shows around an automatic week close.

export const GETTING_READY = 'Getting your next week ready…';
export const CLOSE_FAILED = "Couldn't get your next week ready. Please try again.";

/**
 * "Getting ready" (section 6): shown by every loading view while the close call writes the next week, in place of its
 * usual loading state. The skeleton's pulse stops under reduced motion (index.css).
 */
export const GettingReady: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label={GETTING_READY} showLabel />
  </main>
);

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
 * Next plan (NP-9): with Pro, the fresh plan starts from their level now (asked, with the last result filled in);
 * without Pro it is the goal's text only, as before.
 */
export const BreakChoice: React.FC<{ goal: Goal; choice: PastLimitChoice }> = ({ goal, choice }) => {
  const navigate = useNavigate();
  const { answerChoice } = useGoal();
  const [answering, setAnswering] = useState(false);
  const [askLevel, setAskLevel] = useState(false);
  const isPro = useProEntitlement();
  const launchNextPlan = useNextPlanLaunch();
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
    const result = goal.journeyResult ?? null;
    if (isPro && result) {
      if (needsLevel(result)) setAskLevel(true);
      else launchNextPlan(goal, 'fresh');
      return;
    }
    // The way a goal switch opens goal creation (`usePathwayLaunch`): the draft key and `switchGoal`. WU-24: the text only.
    try {
      localStorage.setItem(DRAFT_GOAL_KEY, goal.rawGoal);
    } catch {
      // Without storage the navigation state still carries the text.
    }
    // B-106: the goal's fixed date is filled in too, so it isn't lost (and can be cleared).
    const fixedDate = fixedDateKey(goal);
    navigate('/onboarding', { state: { draftGoal: goal.rawGoal, isPreset: false, switchGoal: true, ...(fixedDate ? { fixedDate } : {}) } });
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
      {askLevel && goal.journeyResult && (
        <NextPlanLevelDialog
          open
          onOpenChange={(open) => !open && setAskLevel(false)}
          result={goal.journeyResult}
          onContinue={(level) => launchNextPlan(goal, 'fresh', level)}
        />
      )}
    </main>
  );
};
