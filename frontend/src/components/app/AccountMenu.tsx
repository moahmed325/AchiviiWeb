import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, CircleUser, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { Dialog, DialogContent, DialogTrigger, cx } from '../ui';
import { ResetPlanDialog } from './ResetPlanDialog';

/**
 * `app`: email, the goal the user chose (ND-18: `rawGoal`, never the stored outcome), Reset and Sign out.
 * `focused` (onboarding and generation): email and Sign out only.
 */
export type AccountContext = 'app' | 'focused';

const useSignOut = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  // The router applies navigation as a transition. Clearing the session in the same transition means no render sees
  // a protected page without a user, which would redirect to /login instead of the landing page.
  return useCallback(() => {
    React.startTransition(() => {
      logout();
      navigate('/');
    });
  }, [logout, navigate]);
};

const itemClass =
  'focus-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-small text-text-secondary ' +
  'transition-colors duration-(--duration-quick) hover:bg-text/[0.06] hover:text-text';

interface AccountPanelProps {
  context: AccountContext;
  onReset: () => void;
  onSignOut: () => void;
}

const AccountPanel: React.FC<AccountPanelProps> = ({ context, onReset, onSignOut }) => {
  const { user } = useAuth();
  const { activeGoal } = useGoal();
  const withGoal = context === 'app' && activeGoal;

  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-3 pb-4">
        <p className="font-ui-mono text-micro uppercase text-text-secondary">Signed in as</p>
        <p className="mt-1 truncate text-small text-text">{user?.email ?? 'Your account'}</p>
        {withGoal && (
          <>
            <p className="tabular mt-4 font-ui-mono text-micro uppercase text-text-secondary">
              Your goal · Week {activeGoal.currentWeek || 1}
            </p>
            <p className="mt-1 break-words text-small text-text">{activeGoal.rawGoal}</p>
          </>
        )}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {withGoal && (
          <li>
            <button type="button" onClick={onReset} className={itemClass}>
              <RotateCcw aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
              Reset 90-Day Plan
            </button>
          </li>
        )}
        <li>
          <button type="button" onClick={onSignOut} className={itemClass}>
            <LogOut aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  );
};

interface AccountDisclosureProps {
  context: AccountContext;
  /** `up` from the bottom of the rail; `down` from the onboarding top bar. */
  placement: 'up' | 'down';
  className?: string;
}

/**
 * Desktop Account: a disclosure button and a panel of buttons, not a `role="menu"`.
 * Escape and an outside click close it and return focus to the button.
 */
export const AccountDisclosure: React.FC<AccountDisclosureProps> = ({ context, placement, className }) => {
  const { user } = useAuth();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const resetOpenRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const openReset = (next: boolean) => {
    resetOpenRef.current = next;
    setResetOpen(next);
  };

  useEffect(() => {
    // While the reset dialog is open, it owns Escape and outside clicks.
    if (!open || resetOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, resetOpen]);

  // Only a keyboard move to somewhere else closes it: a mouse click that doesn't focus its target has no relatedTarget.
  const onBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (!next || resetOpenRef.current || rootRef.current?.contains(next)) return;
    setOpen(false);
  };

  return (
    <div ref={rootRef} onBlur={onBlur} className={cx('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'focus-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left',
          'transition-colors duration-(--duration-quick) hover:bg-text/[0.06]',
          open && 'bg-text/[0.06]',
        )}
      >
        <CircleUser aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1">
          <span className="block text-small text-text">Account</span>
          {placement === 'up' && user?.email && (
            <span className="block truncate text-small text-text-secondary">{user.email}</span>
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className={cx('size-4 shrink-0 text-text-secondary', placement === 'up' ? (open ? '' : 'rotate-180') : open && 'rotate-180')}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cx(
          'absolute z-50 rounded-card border border-border-strong bg-surface-elevated p-2 pt-4 shadow-overlay',
          placement === 'up' ? 'inset-x-0 bottom-full mb-2' : 'right-0 top-full mt-2 w-72',
        )}
      >
        <AccountPanel context={context} onReset={() => openReset(true)} onSignOut={signOut} />
      </div>
      {context === 'app' && <ResetPlanDialog open={resetOpen} onOpenChange={openReset} onReset={() => setOpen(false)} />}
    </div>
  );
};

interface AccountSheetProps {
  context: AccountContext;
  /** The trigger's classes and content: a bottom-bar item, or a compact top-bar button. */
  triggerClassName: string;
  children: React.ReactNode;
}

/** Mobile Account: the existing Dialog, a bottom sheet under 768 px, with its focus trap and focus return. */
export const AccountSheet: React.FC<AccountSheetProps> = ({ context, triggerClassName, children }) => {
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent title="Account" size="sm">
        <AccountPanel
          context={context}
          onReset={() => setResetOpen(true)}
          onSignOut={() => {
            setOpen(false);
            signOut();
          }}
        />
        {context === 'app' && <ResetPlanDialog open={resetOpen} onOpenChange={setResetOpen} onReset={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
};
