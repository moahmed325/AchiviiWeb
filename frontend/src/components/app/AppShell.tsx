import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { SkipLink } from '../ui';
import { CoachModal } from '../coach/CoachModal';
import { PathwaysExplorerModal } from '../PathwaysExplorerModal';
import { AppBottomBar, AppRail, AppTopBar } from './AppNavigation';
import { shellMode } from './shellEntries';

interface AppShellProps {
  children: React.ReactNode;
  /** The development-only primitives preview, which is chromeless. */
  previewPath?: string;
}

/** The screens that show the active goal's plan (M1.5b, WU-38): Today's choice card comes first. */
const GOAL_SCREENS = ['/dashboard', '/roadmap', '/progress', '/achievement'];

/**
 * The frame around every route (ND-7). Routed pages render their own `main#main`; the shell never adds a second one.
 * The rail comes before the content in the document, so a legacy full-screen overlay inside the page still covers it.
 */
export const AppShell: React.FC<AppShellProps> = ({ children, previewPath }) => {
  const { pathname } = useLocation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { activeGoal, pendingChoice } = useGoal();
  const [pathwaysOpen, setPathwaysOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const mode = shellMode(pathname, Boolean(token), previewPath);

  // M1.5b (WU-38 (1)): while a choice past the limit waits, a screen that shows the goal sends them to Today's card.
  // Leaving answers nothing (unlike the test card), and goal creation stays open for "Start a fresh plan".
  useEffect(() => {
    if (pendingChoice && GOAL_SCREENS.includes(pathname)) navigate('/', { replace: true });
  }, [pathname, pendingChoice, navigate]);

  if (mode === 'chromeless') {
    return <div className="flex min-h-[100dvh] w-full flex-col overscroll-contain bg-background text-text">{children}</div>;
  }

  if (mode === 'bare') {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-text">
        {children}
      </div>
    );
  }

  if (mode === 'focused') {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-text">
        <SkipLink />
        <AppTopBar />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    );
  }

  const openPathways = () => setPathwaysOpen(true);
  const openCoach = () => setCoachOpen(true);

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background text-text">
      <SkipLink />
      <AppRail onOpenPathways={openPathways} onOpenCoach={openCoach} />
      {/*
        A legacy page that is wider than the screen scrolls sideways inside this column instead of widening the
        document. A wider document grows the layout viewport past the visible screen, and the bottom bar and taps on
        it drift away from the bottom edge.
      */}
      <div
        data-shell="content"
        className="flex min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden pt-[env(safe-area-inset-top)] lg:pl-56 lg:pt-0"
      >
        {children}
      </div>
      <AppBottomBar onOpenPathways={openPathways} onOpenCoach={openCoach} />
      <PathwaysExplorerModal isOpen={pathwaysOpen} onClose={() => setPathwaysOpen(false)} activeGoalTitle={activeGoal?.rawGoal} />
      <CoachModal isOpen={coachOpen} onClose={() => setCoachOpen(false)} />
    </div>
  );
};
