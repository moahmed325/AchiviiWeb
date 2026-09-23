import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CommitmentItem } from '../../types';
import { Button, Checkbox, Dialog, DialogContent, Field, Input } from '../ui';
import {
  formatDaysLabel,
  formatDuration,
  formatMinutesTo12h,
  formatMinutesTo24h,
  parseTimeToMinutes,
  type EditingCommitmentSession,
  type PlacedCommitments
} from './schedule';
import { COMMITMENTS_HEADING_ID } from './CommitmentsPanel';

const ALL_DAYS: Array<{ key: string; full: string }> = [
  { key: 'Mon', full: 'Monday' },
  { key: 'Tue', full: 'Tuesday' },
  { key: 'Wed', full: 'Wednesday' },
  { key: 'Thu', full: 'Thursday' },
  { key: 'Fri', full: 'Friday' },
  { key: 'Sat', full: 'Saturday' },
  { key: 'Sun', full: 'Sunday' }
];

const DAY_SHORTCUTS: Array<{ label: string; days: string[] }> = [
  { label: 'Weekdays', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { label: 'Weekends', days: ['Sat', 'Sun'] },
  { label: 'Every day', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }
];

interface CommitmentEditorProps {
  /** Null when closed. */
  session: EditingCommitmentSession | null;
  /** Where the day schedule placed each commitment; used when a commitment has no explicit time range. */
  placedCommitments: PlacedCommitments;
  onItemChange: (patch: Partial<CommitmentItem>) => void;
  /** Adds a new commitment or replaces the edited one. */
  onSave: (item: CommitmentItem) => void;
  onDelete: () => void;
  /** Closes without saving; a new commitment is discarded. */
  onClose: () => void;
}

const TimeStepper: React.FC<{
  label: string;
  value: number;
  onEarlier: () => void;
  onLater: () => void;
  earlierDisabled: boolean;
  laterDisabled: boolean;
}> = ({ label, value, onEarlier, onLater, earlierDisabled, laterDisabled }) => (
  <div role="group" aria-label={label} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border px-4 py-3">
    <div>
      <p className="text-small text-text-secondary">{label}</p>
      <p className="tabular text-body-lg font-medium text-text">{formatMinutesTo12h(value)}</p>
    </div>
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={onEarlier} disabled={earlierDisabled}>
        15 min earlier
      </Button>
      <Button variant="secondary" size="sm" onClick={onLater} disabled={laterDisabled}>
        15 min later
      </Button>
    </div>
  </div>
);

/** Days and time window for one recurring commitment. A bottom sheet on small screens. */
export const CommitmentEditor: React.FC<CommitmentEditorProps> = ({
  session,
  placedCommitments,
  onItemChange,
  onSave,
  onDelete,
  onClose
}) => {
  const opener = useRef<HTMLElement | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [triedWithoutName, setTriedWithoutName] = useState(false);
  if (!session) return null;
  const activeEditingC = session.item;
  const isNew = session.isNew;
  const nameMissing = !activeEditingC.title.trim();

  const close = () => {
    setTriedWithoutName(false);
    onClose();
  };

  let startMins = 1080;
  let endMins = 1140;
  if (activeEditingC.time && activeEditingC.time.includes('-')) {
    const parts = activeEditingC.time.split(',')[0].split('-');
    const s = parseTimeToMinutes(parts[0]?.trim() || '', 1080);
    const e = parseTimeToMinutes(parts[1]?.trim() || '', s + 60);
    if (e > s) {
      startMins = s;
      endMins = e;
    }
  } else if (!isNew) {
    const placedInfo = placedCommitments[activeEditingC.id];
    if (placedInfo) {
      startMins = placedInfo.startMins;
      endMins = placedInfo.endMins;
    }
  }
  const durationMins = endMins - startMins;

  const activeDays =
    activeEditingC.days && activeEditingC.days.length > 0
      ? activeEditingC.days
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const handleSetDays = (days: string[]) => onItemChange({ days });

  const handleToggleSingleDay = (dayKey: string) => {
    let updated: string[];
    if (activeDays.includes(dayKey)) {
      if (activeDays.length <= 1) return;
      updated = activeDays.filter((d) => d !== dayKey);
    } else {
      updated = [...activeDays, dayKey];
    }
    updated.sort(
      (a, b) =>
        ALL_DAYS.findIndex((item) => item.key === a) -
        ALL_DAYS.findIndex((item) => item.key === b)
    );
    handleSetDays(updated);
  };

  const handleAdjustStart = (delta: number) => {
    const newStart = Math.max(0, Math.min(endMins - 15, startMins + delta));
    onItemChange({ time: `${formatMinutesTo24h(newStart)} - ${formatMinutesTo24h(endMins)}` });
  };

  const handleAdjustEnd = (delta: number) => {
    const newEnd = Math.min(1440, Math.max(startMins + 15, endMins + delta));
    onItemChange({ time: `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(newEnd)}` });
  };

  const handleSave = () => {
    if (nameMissing) {
      setTriedWithoutName(true);
      nameInput.current?.focus();
      return;
    }
    setTriedWithoutName(false);
    onSave({
      ...activeEditingC,
      time: `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(endMins)}`,
      days: activeDays
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        title={isNew ? 'Add a commitment' : 'Edit commitment'}
        description="Set its days and hours, and your practice is planned around it."
        onOpenAutoFocus={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          // A suggestion that opened the editor is gone once its commitment is added.
          if (!opener.current?.isConnected) {
            event.preventDefault();
            document.getElementById(COMMITMENTS_HEADING_ID)?.focus();
          }
        }}
        footer={
          <>
            {!isNew && (
              <Button
                variant="danger"
                onClick={onDelete}
                leadingIcon={<Trash2 aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                className="md:mr-auto"
              >
                Delete
              </Button>
            )}
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Done</Button>
          </>
        }
      >
        <div className="flex flex-col gap-7">
          <Field label="Name" error={triedWithoutName && nameMissing ? 'Give it a name, like "Gym" or "School run".' : undefined}>
            <Input ref={nameInput} value={activeEditingC.title} onChange={(e) => onItemChange({ title: e.target.value })} />
          </Field>

          <fieldset className="min-w-0">
            <legend className="text-small font-medium text-text">
              Days <span className="font-normal text-text-secondary">({formatDaysLabel(activeDays)})</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {DAY_SHORTCUTS.map((shortcut) => (
                <Button key={shortcut.label} variant="secondary" size="sm" onClick={() => handleSetDays(shortcut.days)}>
                  {shortcut.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
              {ALL_DAYS.map((d) => (
                <Checkbox
                  key={d.key}
                  label={d.full}
                  checked={activeDays.includes(d.key)}
                  onChange={() => handleToggleSingleDay(d.key)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="min-w-0">
            <legend className="text-small font-medium text-text">
              Time <span className="tabular font-normal text-text-secondary">({formatDuration(durationMins)})</span>
            </legend>
            <div className="mt-3 flex flex-col gap-3">
              <TimeStepper
                label="Starts"
                value={startMins}
                onEarlier={() => handleAdjustStart(-15)}
                onLater={() => handleAdjustStart(15)}
                earlierDisabled={startMins <= 0}
                laterDisabled={startMins >= endMins - 15}
              />
              <TimeStepper
                label="Ends"
                value={endMins}
                onEarlier={() => handleAdjustEnd(-15)}
                onLater={() => handleAdjustEnd(15)}
                earlierDisabled={endMins <= startMins + 15}
                laterDisabled={endMins >= 1440}
              />
            </div>
          </fieldset>
        </div>
      </DialogContent>
    </Dialog>
  );
};
