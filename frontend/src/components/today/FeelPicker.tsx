import React, { useState } from 'react';
import type { DailyTask, Feel } from '../../types';
import { SegmentedControl, TextLink } from '../ui';
import { NOT_SAVED } from '../../lib/weekClose';
import { useTaskActions } from './useTaskActions';

/** The three taps, in the order they show (docs/features/no-weekly-tests/plan.md section 7). */
const FEEL_OPTIONS: ReadonlyArray<{ value: Feel; label: string }> = [
  { value: 'too_easy', label: 'Too easy' },
  { value: 'just_right', label: 'Just right' },
  { value: 'too_hard', label: 'Too hard' },
];

const isFeel = (value: string): value is Feel => FEEL_OPTIONS.some((option) => option.value === value);

/**
 * No weekly tests, section 7: after a done session, one optional tap for how it felt. Next week is written from these
 * taps and the day's notes, never the week that is running. Each tap saves at once; choosing another replaces it.
 * `onAddNote` opens the day's notes, where anything worth saying goes.
 */
export const FeelPicker: React.FC<{ task: DailyTask; onAddNote: () => void }> = ({ task, onAddNote }) => {
  const { saveFeel } = useTaskActions();
  const [pending, setPending] = useState<Feel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = pending ?? task.feel ?? undefined;

  const choose = async (next: string) => {
    // One save at a time, so two quick taps can never finish in the other order.
    if (!isFeel(next) || next === task.feel || pending) return;
    setPending(next);
    setError(null);
    const result = await saveFeel(task, next);
    setPending(null);
    if (!result.ok) setError(NOT_SAVED);
  };

  return (
    <div className="mt-7 max-w-md">
      <SegmentedControl
        legend="How did it feel?"
        options={FEEL_OPTIONS.map((option) => ({ ...option, disabled: pending !== null && option.value !== pending }))}
        value={value}
        onChange={choose}
        error={error ?? undefined}
      />
      <p role="status" className="mt-3 text-small text-text-secondary">
        {task.feel && !pending ? (
          <>
            Thanks. Next week takes it into account.{' '}
            <TextLink asChild>
              <button type="button" onClick={onAddNote}>
                Add a note
              </button>
            </TextLink>
          </>
        ) : (
          'Optional. Next week is planned from what you did and how it felt.'
        )}
      </p>
    </div>
  );
};
