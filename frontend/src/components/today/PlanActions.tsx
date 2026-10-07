import React, { useState } from 'react';
import type { DailyTask, Goal, Reconciliation } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { carryNow, markTodayMissed, swapDays } from '../../lib/api';
import type { PlanAction, Place } from './usePlanAction';
import { todayActions, weekdayOf, type MissNotice } from '../../lib/today';
import { Button, Dialog, DialogClose, DialogContent, Spinner, cx } from '../ui';

/*
 * Missed sessions M3.3: the swap offer's answers, "Set today aside" and "Swap with another day" (AC-2, AC-6, ND-14).
 * Each action answers with the reconcile body, which the goal context keeps before it reloads the goal, so the
 * notice line above shows what happened. Nothing here renders while the switch is off (ND-15): `missNotice` gives
 * no swap offer and `todayActions` gives null then.
 */

const Failure: React.FC<{ action: PlanAction; at: Place }> = ({ action, at }) =>
  action.message?.at === at ? (
    <p role="alert" className="mt-3 text-small text-danger">
      {action.message.text}
    </p>
  ) : null;

/** The day's steps exactly as loaded: the server swaps only if neither day changed since (`expected`, M2.4). */
const expectedOf = (...days: DailyTask[]) => Object.fromEntries(days.map((day) => [day.id, day.detailedSteps]));

/** The two answers to a key session's swap offer (RULE-6, ND-9), under its line in Today's notice. */
export const SwapOfferAnswers: React.FC<{
  notice: Extract<MissNotice, { kind: 'swap_offer' }>;
  goal: Goal;
  action: PlanAction;
}> = ({ notice, goal, action }) => {
  const missed = (goal.dailyTasks || []).find((task) => task.id === notice.missedTaskId);
  const receiving = (goal.dailyTasks || []).find((task) => task.id === notice.receivingTaskId);
  if (!missed || !receiving) return null;
  return (
    <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          variant="primary"
          loading={action.busy === 'offer-swap'}
          onClick={() => action.run('offer', 'offer-swap', (token) => swapDays(missed.id, receiving.id, expectedOf(missed, receiving), token))}
          className="w-full sm:w-auto"
        >
          Swap the days
        </Button>
        <Button
          variant="secondary"
          loading={action.busy === 'offer-carry'}
          onClick={() => action.run('offer', 'offer-carry', (token) => carryNow(missed.id, token))}
          className="w-full sm:w-auto"
        >
          Just move its main step
        </Button>
      </div>
      <Failure action={action} at="offer" />
    </>
  );
};

/** "Set today aside" and "Swap with another day", quiet, under Today's main actions on Today's view of today. */
export const TodayPlanActions: React.FC<{ goal: Goal; action: PlanAction; now: Date; timezone?: string }> = ({
  goal,
  action,
  now,
  timezone,
}) => {
  const { reconciliation } = useGoal();
  const [open, setOpen] = useState<'aside' | 'swap' | null>(null);
  const actions = todayActions(reconciliation, goal, now, timezone);
  const changed = action.message?.at === 'plan' ? action.message.text : null;
  if (!actions && !changed) return null;

  const openDialog = (which: 'aside' | 'swap') => {
    action.clear();
    setOpen(which);
  };
  const close = (value: boolean) => {
    if (!value) setOpen(null);
  };
  const send = async (at: 'aside' | 'swap', key: string, call: (token: string) => Promise<Reconciliation>) => {
    const outcome = await action.run(at, key, call);
    if (outcome === 'done' || outcome === 'changed') setOpen(null);
  };

  return (
    <div className="mt-4">
      {actions && (actions.canSetAside || actions.canSwap) && (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {actions.canSetAside && (
            <Button variant="quiet" size="sm" onClick={() => openDialog('aside')}>
              Set today aside
            </Button>
          )}
          {actions.canSwap && (
            <Button variant="quiet" size="sm" onClick={() => openDialog('swap')}>
              Swap with another day
            </Button>
          )}
        </div>
      )}
      {changed && (
        <p role="status" className="mt-3 text-small text-text-secondary">
          {changed}
        </p>
      )}

      {actions && (
        <Dialog open={open === 'aside'} onOpenChange={close}>
          <DialogContent
            title="Set today's session aside?"
            description="Nothing gets longer."
            size="sm"
            hideClose
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="secondary">Keep today</Button>
                </DialogClose>
                <Button
                  variant="primary"
                  loading={action.busy === 'aside'}
                  onClick={() => send('aside', 'aside', (token) => markTodayMissed(actions.today.id, token))}
                >
                  Set it aside
                </Button>
              </>
            }
          >
            <Failure action={action} at="aside" />
          </DialogContent>
        </Dialog>
      )}

      {actions && (
        <Dialog open={open === 'swap'} onOpenChange={close}>
          {actions.swapWith.length > 0 ? (
            <DialogContent title="Swap with another day" size="sm">
              <ul className="-mx-3 flex flex-col">
                {actions.swapWith.map((day) => {
                  const busy = action.busy === `swap-${day.id}`;
                  return (
                    <li key={day.id}>
                      <button
                        type="button"
                        aria-busy={busy || undefined}
                        onClick={() =>
                          send('swap', `swap-${day.id}`, (token) =>
                            swapDays(actions.today.id, day.id, expectedOf(actions.today, day), token),
                          )
                        }
                        className={cx(
                          'focus-ring flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-body text-text',
                          'transition-colors duration-(--duration-quick) hover:bg-text/[0.05]',
                        )}
                      >
                        <span className="min-w-0">
                          {weekdayOf(day.date) ?? day.dayOfWeek}: {day.title}
                        </span>
                        {busy && <Spinner className="shrink-0 text-text-secondary" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Failure action={action} at="swap" />
            </DialogContent>
          ) : (
            <DialogContent
              title="Swap with another day"
              description="No other day this week can be swapped."
              size="sm"
              hideClose
              footer={
                <DialogClose asChild>
                  <Button variant="secondary">Close</Button>
                </DialogClose>
              }
            />
          )}
        </Dialog>
      )}
    </div>
  );
};
