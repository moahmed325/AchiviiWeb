import { useEffect, useRef, useState } from 'react';
import type { DailyTask, Goal } from '../../types';
import { swapDays } from '../../lib/api';
import type { MissNotice } from '../../lib/today';
import type { PlanAction } from './usePlanAction';

/** The day's steps exactly as loaded: the server swaps only if neither day changed since (`expected`, M2.4). */
export const expectedOf = (...days: DailyTask[]) => Object.fromEntries(days.map((day) => [day.id, day.detailedSteps]));

/**
 * ND-25: a key session that didn't happen is swapped onto its receiving day without asking, once, when Today shows the
 * offer (an unanswered offer used to drop the key session at the receiving day's close). It goes through the same
 * swap call as "Swap the days", so every rule and guard still applies. Only for a past day: a session the person set
 * aside today is their own choice, so it still asks. Returns 'moving' while sent, 'moved' once written, and 'ask' when
 * there is nothing to do or the swap was refused (the answers then show as before).
 */
export type AutoSwap = { status: 'ask' } | { status: 'moving' } | { status: 'moved'; day: string; when: string };

export function useAutoSwap(notice: MissNotice | null, goal: Goal, action: PlanAction): AutoSwap {
  const offer = notice?.kind === 'swap_offer' && notice.day ? notice : null;
  const tried = useRef<string | null>(null);
  const [result, setResult] = useState<{ key: string; swap: AutoSwap } | null>(null);
  const missed = offer ? (goal.dailyTasks || []).find((task) => task.id === offer.missedTaskId) : undefined;
  const receiving = offer ? (goal.dailyTasks || []).find((task) => task.id === offer.receivingTaskId) : undefined;
  const key = offer && missed && receiving ? `${missed.id}:${receiving.id}` : null;

  useEffect(() => {
    if (!offer?.day || !key || !missed || !receiving || tried.current === key) return;
    tried.current = key;
    const moved: AutoSwap = { status: 'moved', day: offer.day, when: offer.when };
    void action.run('offer', 'offer-swap', (token) => swapDays(missed.id, receiving.id, expectedOf(missed, receiving), token)).then((outcome) => {
      // A refusal or failure the person did not cause is not shown as theirs: the answers show, without an error.
      if (outcome !== 'done') action.clear();
      setResult({ key, swap: outcome === 'done' ? moved : { status: 'ask' } });
    });
  }, [offer, key, missed, receiving, action]);

  // Once written, the line stays while this screen is open (the reloaded plan no longer holds the offer).
  if (result?.swap.status === 'moved') return result.swap;
  if (result && result.key === key) return result.swap;
  return key ? { status: 'moving' } : { status: 'ask' };
}
