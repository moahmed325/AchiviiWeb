import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { Goal } from '../../types';
import { useAccess } from '../../hooks/useAccess';
import { TRIAL_NOTICE_DAYS, trialDaysLeft } from '../../lib/access';
import { ProCheckout } from '../billing';
import { Button, Dialog, DialogContent, DialogTrigger } from '../ui';

const daysText = (days: number) => (days === 1 ? 'Today is the last day' : `${days} days left`);

/**
 * ND-37: the trial's last week, on Today. Quiet: one line and a way to Pro; earlier in the 30 days it shows nothing.
 */
export const TrialNotice: React.FC = () => {
  const { state, trialEndsAt } = useAccess();
  const days = trialDaysLeft(trialEndsAt);
  if (state !== 'trial' || days > TRIAL_NOTICE_DAYS || days < 1) return null;
  return (
    <aside
      aria-label="Your free trial"
      className="relative mb-8 flex flex-col gap-3 rounded-card border border-achievement/30 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-small text-text">
        <span className="font-medium">{daysText(days)} of your free trial.</span>{' '}
        <span className="text-text-secondary">Go Pro to keep your plan going after it.</span>
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" className="self-start sm:self-auto">
            See Pro
          </Button>
        </DialogTrigger>
        <DialogContent size="lg" title="Achivii Pro" aria-describedby={undefined}>
          <ProCheckout />
        </DialogContent>
      </Dialog>
    </aside>
  );
};

/**
 * ND-37: past the 30-day trial without Pro, Today shows this instead of the day's step. The plan is paused, not
 * gone: the Roadmap and Dashboard still show it, and Pro picks it up where it stopped.
 */
export const TrialEnded: React.FC<{ goal: Goal }> = ({ goal }) => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 text-left sm:py-14">
    <p className="flex items-center gap-2 font-ui-mono text-micro uppercase text-achievement">
      <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4" />
      Your 30 free days are done
    </p>
    <h1 className="mt-4 max-w-[22ch] text-h1 text-text">Keep going where you left off.</h1>
    <p className="mt-4 max-w-xl text-body-lg text-text-secondary">
      Your plan for “{goal.rawGoal}”, your progress and your notes are all kept. Go Pro and tomorrow’s step is waiting,
      planned from what you’ve done.
    </p>
    <ProCheckout className="mt-10" />
    <p className="mt-8 text-small text-text-secondary">
      Not now? You can still look back over your plan on the{' '}
      <Link to="/roadmap" className="focus-ring rounded-block text-text underline underline-offset-4">
        Roadmap
      </Link>
      .
    </p>
  </main>
);
