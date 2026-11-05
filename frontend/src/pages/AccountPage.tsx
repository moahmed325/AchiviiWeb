import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ExternalLink, LogOut, RotateCcw, Sparkles } from 'lucide-react';
import { useAuth, useFirstName } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { useAccess } from '../hooks/useAccess';
import { fetchBillingAccountState, type BillingAccountState } from '../lib/api';
import { TRIAL_DAYS, trialDaysLeft } from '../lib/access';
import { finishDate } from '../lib/plan';
import { planWeeks } from '../lib/planLength';
import { Badge, Button, Dialog, DialogContent, ProgressBar, Skeleton } from '../components/ui';
import { NameForm } from '../components/dashboard/NameForm';
import { ProCheckout } from '../components/billing';
import { RemindersSetting, TimezoneNotice } from '../components/app/AccountMenu';
import { useSignOut } from '../hooks/useSignOut';
import { EditScheduleDialog } from '../components/app/EditScheduleDialog';
import { ResetPlanDialog } from '../components/app/ResetPlanDialog';

/** The city part of an IANA zone, for people: "Asia/Tokyo" -> "Tokyo". */
const placeOf = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

const longDate = (iso: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(iso));

/**
 * ND-38: Account as a page. Who you are, your membership (the trial or Pro, with the one action that fits), the goal
 * you're on and its schedule, your preferences, then sign out and, set apart, starting over.
 */
export const AccountPage: React.FC = () => {
  const { user } = useAuth();
  const { firstName } = useFirstName();
  const { activeGoal } = useGoal();
  const signOut = useSignOut();
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const since = user?.created_at ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(user.created_at)) : null;
  const initial = (firstName || user?.email || '?').trim().charAt(0).toUpperCase();
  const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

  return (
    <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
      <header className="animate-rise-in flex items-center gap-5" style={stagger(0)}>
        <span className="account-avatar" aria-hidden="true">{initial}</span>
        <div className="min-w-0">
          <h1 className="truncate text-h2 text-text">{firstName ?? 'Your account'}</h1>
          <p className="mt-1 truncate text-body text-text-secondary">
            {user?.email}
            {since && <span className="hidden sm:inline"> · Member since {since}</span>}
          </p>
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-5">
        <Membership stagger={stagger(80)} />

        {activeGoal && (
          <section aria-labelledby="goal-heading" className="dash-panel animate-rise-in p-6 sm:p-7" style={stagger(160)}>
            <h2 id="goal-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your goal</h2>
            <p className="mt-3 break-words text-body-lg text-text">{activeGoal.rawGoal}</p>
            <p className="tabular mt-1 text-small text-text-secondary">
              Week {activeGoal.currentWeek || 1} of {planWeeks(activeGoal)}
              {finishDate(activeGoal) ? ' · finishes ' + finishDate(activeGoal) : ''}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setScheduleOpen(true)} leadingIcon={<CalendarDays aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                Edit my schedule
              </Button>
              <Button asChild variant="quiet" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                <Link to="/roadmap">See the roadmap</Link>
              </Button>
            </div>
          </section>
        )}

        <section aria-labelledby="profile-heading" className="dash-panel animate-rise-in p-6 sm:p-7" style={stagger(240)}>
          <h2 id="profile-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Profile</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <NameForm label="First name" />
            <div>
              <p className="mb-2 text-small font-medium text-text">Email</p>
              <p className="flex min-h-11 items-center truncate text-body text-text-secondary">{user?.email}</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="preferences-heading" className="dash-panel animate-rise-in p-6 sm:p-7" style={stagger(320)}>
          <h2 id="preferences-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Preferences</h2>
          <div className="mt-5">
            <p className="text-small font-medium text-text">Time zone</p>
            <p className="mt-1 text-small text-text-secondary">
              {user?.timezone ? 'Your days start and end on ' + placeOf(user.timezone) + ' time.' : 'Your days follow this device’s time.'}
            </p>
            <TimezoneNotice />
          </div>
          {user?.remindersAvailable && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-small font-medium text-text">Reminders</p>
              <RemindersSetting />
            </div>
          )}
        </section>

        <div className="animate-rise-in mt-2 flex flex-col gap-5" style={stagger(400)}>
          <Button variant="secondary" className="self-start" onClick={signOut} leadingIcon={<LogOut aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
            Sign out
          </Button>
          {activeGoal && (
            <section aria-labelledby="restart-heading" className="account-restart p-6 sm:p-7">
              <h2 id="restart-heading" className="text-body font-medium text-text">Start over</h2>
              <p className="mt-1 max-w-xl text-small text-text-secondary">
                Delete this plan and its history and set a new goal. This can&apos;t be undone.
              </p>
              <Button variant="danger" size="sm" className="mt-4" onClick={() => setResetOpen(true)} leadingIcon={<RotateCcw aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                Reset my plan
              </Button>
            </section>
          )}
        </div>
      </div>

      {activeGoal && <EditScheduleDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />}
      {activeGoal && <ResetPlanDialog open={resetOpen} onOpenChange={setResetOpen} />}
    </main>
  );
};

/**
 * The membership card (ND-37): Pro with its renewal and Manage; the free trial with the days left and Go Pro; a trial
 * that has ended with Go Pro; before the first plan, when the trial starts. The billing answer can fail on its own.
 */
const Membership: React.FC<{ stagger: React.CSSProperties }> = ({ stagger }) => {
  const { token } = useAuth();
  const access = useAccess();
  const [billing, setBilling] = React.useState<BillingAccountState | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [loads, setLoads] = React.useState(0);

  React.useEffect(() => {
    if (!token) return;
    let live = true;
    setFailed(false);
    fetchBillingAccountState(token)
      .then((state) => live && setBilling(state))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [token, loads]);

  const pro = billing?.plan === 'pro' || access.state === 'pro';
  const attention = billing && (billing.status === 'PAST_DUE_RECOVERY' || billing.status === 'UNPAID');
  const left = access.state === 'trial' ? trialDaysLeft(access.trialEndsAt) : 0;

  let title: string;
  let line: string;
  if (pro) {
    title = 'Achivii Pro';
    line = billing?.currentPeriodEnd
      ? (billing.cancelAtPeriodEnd ? 'Your access runs until ' : 'Renews on ') + longDate(billing.currentPeriodEnd) + '.'
      : 'Every pathway and custom goal, with no limits.';
  } else if (access.state === 'trial') {
    title = 'Free trial';
    line = left === 1 ? '1 day left. Go Pro to keep your plan going.' : left + ' days left. Go Pro to keep your plan going.';
  } else if (access.state === 'locked') {
    title = 'Your free trial has ended';
    line = 'Your plan is paused and kept as it is. Go Pro to pick up where you left off.';
  } else {
    title = 'Free';
    line = 'Your ' + TRIAL_DAYS + '-day free trial starts with your first plan.';
  }

  const loading = token && !billing && !failed && access.state === null;

  return (
    <section aria-labelledby="membership-heading" className="dash-card animate-rise-in p-6 sm:p-7" style={stagger}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="membership-heading" className="font-ui-mono text-micro uppercase text-achievement">Membership</h2>
        {pro && !attention && <Badge tone="achievement">Pro</Badge>}
        {attention && <Badge tone="achievement">Payment needs attention</Badge>}
      </div>
      {loading ? (
        <div className="mt-4"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-4 w-64" /></div>
      ) : (
        <>
          <p className="mt-3 text-h3 text-text">{title}</p>
          <p className="mt-1 max-w-xl text-body text-text-secondary">{line}</p>
          {access.state === 'trial' && !pro && (
            <ProgressBar
              className="mt-5"
              tone="achievement"
              hideLabel
              label="Free trial used"
              value={TRIAL_DAYS - left}
              max={TRIAL_DAYS}
              valueText={left + ' of ' + TRIAL_DAYS + ' days left'}
            />
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            {pro && billing?.manageUrl && (
              <Button asChild variant="secondary" trailingIcon={<ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                <a href={billing.manageUrl} target="_blank" rel="noreferrer">Manage subscription</a>
              </Button>
            )}
            {!pro && access.state !== null && access.state !== 'new' && (
              <Button variant="gold" onClick={() => setUpgradeOpen(true)} leadingIcon={<Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
                Go Pro
              </Button>
            )}
          </div>
          {failed && (
            <p className="mt-4 text-small text-text-secondary">
              We couldn&apos;t load your billing details.{' '}
              <button type="button" onClick={() => setLoads((n) => n + 1)} className="focus-ring rounded-control text-text underline">
                Try again
              </button>
            </p>
          )}
        </>
      )}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent title="Achivii Pro" size="lg">
          <ProCheckout />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default AccountPage;
