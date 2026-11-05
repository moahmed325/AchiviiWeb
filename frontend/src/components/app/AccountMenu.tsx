import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, CircleUser, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSignOut } from '../../hooks/useSignOut';
import { Button, Checkbox, Dialog, DialogContent, DialogTrigger, cx } from '../ui';

const itemClass =
  'focus-ring flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left text-small text-text-secondary ' +
  'transition-colors duration-(--duration-quick) hover:bg-text/[0.06] hover:text-text';

/** The city part of an IANA zone, for people: "Asia/Tokyo" -> "Tokyo". */
const placeOf = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ');

/**
 * B-46 (2), Travelling Leo: the plan keeps the zone set at sign-up; when this device is somewhere else, the person can
 * move the plan here. Shown only when the two differ.
 */
export const TimezoneNotice: React.FC = () => {
  const { user, setTimezone } = useAuth();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  let device: string | undefined;
  try {
    device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    device = undefined;
  }
  if (!user?.timezone || !device || device === user.timezone) return null;
  const move = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await setTimezone(device!);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-4">
      <p className="text-small text-text-secondary">
        Your plan uses {placeOf(user.timezone)} time. This device is in {placeOf(device)}.
      </p>
      <Button size="sm" variant="secondary" loading={saving} onClick={move} className="mt-2">
        Use {placeOf(device)} time
      </Button>
      {failed && <p role="alert" className="mt-2 text-small text-danger">That didn't save. Please try again.</p>}
    </div>
  );
};

/**
 * ND-28: the missed-day reminder email, on unless turned off. Shown only while reminders are really sent
 * (`remindersAvailable`), so it never promises an email that won't come. Saves on change; a failed save says so.
 */
export const RemindersSetting: React.FC = () => {
  const { user, setReminders } = useAuth();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!user?.remindersAvailable) return null;
  const on = user.remindersEnabled !== false;
  const change = async (enabled: boolean) => {
    setSaving(true);
    setFailed(false);
    try {
      await setReminders(enabled);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-4">
      <Checkbox
        label="Email me after a missed day"
        description="One gentle note with today's step. Never more than one per break."
        checked={on}
        disabled={saving}
        onChange={(event) => void change(event.target.checked)}
      />
      {failed && <p role="alert" className="mt-1 text-small text-danger">That didn't save. Please try again.</p>}
    </div>
  );
};

/** Onboarding's Account: who is signed in and Sign out. Everything else lives on the Account page (ND-39). */
const AccountPanel: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  const { user } = useAuth();
  return (
    <div className="flex flex-col">
      <div className="border-b border-border px-3 pb-4">
        <p className="font-ui-mono text-micro uppercase text-text-secondary">Signed in as</p>
        <p className="mt-1 truncate text-small text-text">{user?.email ?? 'Your account'}</p>
      </div>
      <ul className="mt-2 flex flex-col gap-1">
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

/**
 * Onboarding's top bar, desktop: a disclosure button and a panel, not a `role="menu"`.
 * Escape and an outside click close it and return focus to the button.
 */
export const AccountDisclosure: React.FC<{ className?: string }> = ({ className }) => {
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // Only a keyboard move to somewhere else closes it: a mouse click that doesn't focus its target has no relatedTarget.
  const onBlur = (event: React.FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (!next || rootRef.current?.contains(next)) return;
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
        <span className="min-w-0 flex-1 text-small text-text">Account</span>
        <ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4 shrink-0 text-text-secondary', open && 'rotate-180')} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2 w-72 rounded-card border border-border-strong bg-surface-elevated p-2 pt-4 shadow-overlay"
      >
        <AccountPanel onSignOut={signOut} />
      </div>
    </div>
  );
};

/** Onboarding's top bar, mobile: the Dialog, a bottom sheet under 768 px, with its focus trap and focus return. */
export const AccountSheet: React.FC<{ triggerClassName: string; children: React.ReactNode }> = ({ triggerClassName, children }) => {
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {children}
        </button>
      </DialogTrigger>
      <DialogContent title="Account" size="sm">
        <AccountPanel
          onSignOut={() => {
            setOpen(false);
            signOut();
          }}
        />
      </DialogContent>
    </Dialog>
  );
};
