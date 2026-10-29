import React from 'react';
import { Target } from 'lucide-react';
import { Field, Input } from '../ui/Field';
import type { WeekTarget, WeekTest } from '../../types';
import { nextCheckLine } from '../../lib/lightTest';

export interface LightTestEntryProps {
  /** The week the test belongs to, for "Next check, week {n}". */
  weekNumber?: number;
  target?: WeekTarget | null;
  test: WeekTest;
  note: string;
  onNoteChange: (note: string) => void;
  disabled?: boolean;
  /** The "I did it" button when the entry holds it (the review step); a dialog puts it in its footer instead. */
  action?: React.ReactNode;
  /** B-109: the plan's weeks (a shorter plan's ready week reads as its final target); missing is 12. */
  totalWeeks?: number;
}

/**
 * Weekly update M2.1 (requirement 7, WU-43 (2)): a light week's test entry: the light test, a note and one "I did it".
 * No number field and nothing set against the target; the target shows as the next check it builds toward.
 */
export const LightTestEntry: React.FC<LightTestEntryProps> = ({ weekNumber, target, test, note, onNoteChange, disabled = false, action, totalWeeks }) => (
  <div className="space-y-4 rounded-card border border-border bg-surface p-5 text-left sm:p-6">
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
        <Target aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-accent" />
        <span>Light test</span>
      </div>
      <h3 className="text-body font-semibold text-text">{test.instructions}</h3>
      {target && weekNumber !== undefined && <p className="text-small text-text-secondary">{nextCheckLine(weekNumber, target, { totalWeeks })}</p>}
    </div>
    <Field id="light-test-note" label="Note" showOptional hint="How it went, in a few words.">
      <Input
        name="light-test-note"
        type="text"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="e.g. Felt easy, legs a bit heavy at the end"
        disabled={disabled}
      />
    </Field>
    {action}
  </div>
);

export default LightTestEntry;
