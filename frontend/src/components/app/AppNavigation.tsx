import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CircleUser, Compass, Map as MapIcon, Sun, type LucideIcon } from 'lucide-react';
import { useGoal } from '../../context/GoalContext';
import { cx } from '../ui';
import { Wordmark } from '../marketing/Wordmark';
import { AccountDisclosure, AccountSheet } from './AccountMenu';
import { OfflineChip } from './OfflineChip';
import { shellEntries } from './shellEntries';

interface AppNavigationProps {
  onOpenPathways: () => void;
}

const useEntries = () => {
  const { pathname } = useLocation();
  const { activeGoal, apiStatus } = useGoal();
  return { ...shellEntries(pathname, Boolean(activeGoal)), offline: apiStatus === 'offline' };
};

const railItem = (active: boolean) =>
  cx(
    'focus-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-small',
    'transition-colors duration-(--duration-quick)',
    active ? 'bg-text/[0.07] text-text' : 'text-text-secondary hover:bg-text/[0.04] hover:text-text',
  );

const RailIcon: React.FC<{ icon: LucideIcon; active?: boolean }> = ({ icon: Icon, active }) => (
  <Icon aria-hidden="true" strokeWidth={1.5} className={cx('size-5 shrink-0', active ? 'text-accent-hover' : '')} />
);

/** Desktop (lg and up): a restrained left rail. Today, Roadmap, Pathways, then Account at the bottom (ND-7). */
export const AppRail: React.FC<AppNavigationProps> = ({ onOpenPathways }) => {
  const { todayActive, roadmapActive, showRoadmap, offline } = useEntries();

  return (
    <div
      data-shell="rail"
      className="ui-root fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-border bg-background px-3 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] lg:flex"
    >
      <Link to="/" aria-label="Achivii, home" className="focus-ring ml-3 inline-flex min-h-11 items-center self-start rounded-full">
        <Wordmark />
      </Link>
      <nav aria-label="Primary" className="mt-8 flex min-h-0 flex-1 flex-col">
        <ul className="flex flex-col gap-1">
          <li>
            <Link to="/" aria-current={todayActive ? 'page' : undefined} className={railItem(todayActive)}>
              <RailIcon icon={Sun} active={todayActive} />
              Today
            </Link>
          </li>
          {showRoadmap && (
            <li>
              <Link to="/roadmap" aria-current={roadmapActive ? 'page' : undefined} className={railItem(roadmapActive)}>
                <RailIcon icon={MapIcon} active={roadmapActive} />
                Roadmap
              </Link>
            </li>
          )}
          <li>
            <button type="button" onClick={onOpenPathways} className={railItem(false)}>
              <RailIcon icon={Compass} />
              Pathways
            </button>
          </li>
        </ul>
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          {offline && <OfflineChip className="ml-3 self-start" />}
          <AccountDisclosure context="app" placement="up" />
        </div>
      </nav>
    </div>
  );
};

const barItem = (active: boolean) =>
  cx(
    'focus-ring-inset relative flex min-h-16 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-control text-small',
    'transition-colors duration-(--duration-quick)',
    active ? 'text-text' : 'text-text-secondary hover:text-text',
  );

const BarIcon: React.FC<{ icon: LucideIcon; active?: boolean }> = ({ icon: Icon, active }) => (
  <Icon aria-hidden="true" strokeWidth={1.5} className={cx('size-5', active ? 'text-accent-hover' : '')} />
);

/** The active item carries a mark as well as colour, so the state is not colour alone. */
const ActiveMark: React.FC = () => <span aria-hidden="true" className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />;

/**
 * Below lg: a bottom bar with Today, Roadmap (with a goal), Pathways and Account. Sticky rather than fixed, so it
 * takes its own height at the end of the page and never covers content. It sits above the bottom safe area, and
 * below every dialog, sheet and focus mode (z-40 under their z-50).
 */
export const AppBottomBar: React.FC<AppNavigationProps> = ({ onOpenPathways }) => {
  const { todayActive, roadmapActive, showRoadmap, offline } = useEntries();

  return (
    <>
      <div
        data-shell="bottom-bar"
        className="ui-root sticky bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {offline && (
          <div className="flex justify-center border-b border-border py-1.5">
            <OfflineChip />
          </div>
        )}
        <nav aria-label="Primary" className="mx-auto max-w-lg px-2">
          <ul className="flex">
            <li className="min-w-0 flex-1">
              <Link to="/" aria-current={todayActive ? 'page' : undefined} className={barItem(todayActive)}>
                {todayActive && <ActiveMark />}
                <BarIcon icon={Sun} active={todayActive} />
                Today
              </Link>
            </li>
            {showRoadmap && (
              <li className="min-w-0 flex-1">
                <Link to="/roadmap" aria-current={roadmapActive ? 'page' : undefined} className={barItem(roadmapActive)}>
                  {roadmapActive && <ActiveMark />}
                  <BarIcon icon={MapIcon} active={roadmapActive} />
                  Roadmap
                </Link>
              </li>
            )}
            <li className="min-w-0 flex-1">
              <button type="button" onClick={onOpenPathways} className={barItem(false)}>
                <BarIcon icon={Compass} />
                Pathways
              </button>
            </li>
            <li className="min-w-0 flex-1">
              <AccountSheet context="app" triggerClassName={barItem(false)}>
                <BarIcon icon={CircleUser} />
                Account
              </AccountSheet>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
};

/** Onboarding and generation: the wordmark, the offline chip and Account (email and Sign out). No rail, no bottom bar. */
export const AppTopBar: React.FC = () => {
  const { apiStatus } = useGoal();

  return (
    <header className="ui-root sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-gutter">
      <Link to="/" aria-label="Achivii, home" className="focus-ring inline-flex min-h-11 items-center rounded-full">
        <Wordmark />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        {apiStatus === 'offline' && <OfflineChip />}
        <AccountDisclosure context="focused" placement="down" className="hidden lg:block" />
        <AccountSheet
          context="focused"
          triggerClassName="focus-ring inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-small text-text-secondary transition-colors duration-(--duration-quick) hover:bg-text/[0.06] hover:text-text lg:hidden"
        >
          <CircleUser aria-hidden="true" strokeWidth={1.5} className="size-5" />
          Account
        </AccountSheet>
      </div>
    </header>
  );
};
