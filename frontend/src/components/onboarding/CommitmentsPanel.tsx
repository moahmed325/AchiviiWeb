import React from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { CommitmentItem, RoutineSettings } from '../../types';
import { Button, Field, IconButton, Input } from '../ui';
import {
  EMPTY_COMMITMENT_DRAFT,
  PRESET_COMMITMENTS,
  formatDaysLabel,
  formatMinutesTo12h,
  getCategoryDetails,
  newCommitmentId,
  type CustomCommitmentDraft,
  type PlacedCommitments,
  type PresetCommitment
} from './schedule';

interface CommitmentsPanelProps {
  routine: RoutineSettings;
  /** Where the day schedule placed each commitment. */
  placedCommitments: PlacedCommitments;
  draft: CustomCommitmentDraft;
  onDraftChange: (draft: CustomCommitmentDraft) => void;
  /** Opens the editor for a commitment that is only added once the user confirms it. */
  onAddCommitment: (commitment: CommitmentItem) => void;
  onEditCommitment: (commitment: CommitmentItem) => void;
  onRemoveCommitment: (id: string) => void;
}

export const COMMITMENTS_HEADING_ID = 'commitments-heading';

const sameTitle = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Recurring commitments the practice is planned around. Optional. */
export const CommitmentsPanel: React.FC<CommitmentsPanelProps> = ({
  routine,
  placedCommitments,
  draft,
  onDraftChange,
  onAddCommitment,
  onEditCommitment,
  onRemoveCommitment
}) => {
  const commitments = routine.commitments || [];
  const suggestions = PRESET_COMMITMENTS.filter((p) => !commitments.some((c) => sameTitle(c.title, p.title)));

  const addPreset = (preset: PresetCommitment) =>
    onAddCommitment({
      id: newCommitmentId(),
      title: preset.title,
      time: preset.defaultTime,
      category: preset.category,
      days: preset.defaultDays || ['Mon', 'Wed', 'Fri']
    });

  const addCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const newCommitment: CommitmentItem = {
      id: newCommitmentId(),
      title: draft.title.trim(),
      time: draft.time.trim() || '18:00 - 19:00',
      category: 'other',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    };
    onDraftChange(EMPTY_COMMITMENT_DRAFT);
    onAddCommitment(newCommitment);
  };

  return (
    <section aria-labelledby={COMMITMENTS_HEADING_ID}>
      <h3 id={COMMITMENTS_HEADING_ID} tabIndex={-1} className="text-body font-medium text-text outline-none">
        Anything else that repeats each week? <span className="font-normal text-text-secondary">(optional)</span>
      </h3>
      <p className="mt-1 max-w-xl text-small text-text-secondary">
        Add regular commitments, like the gym or a commute, and your practice is planned around them.
      </p>

      {commitments.length > 0 && (
        <ul className="mt-5 divide-y divide-border rounded-card border border-border">
          {commitments.map((c) => {
            const Icon = getCategoryDetails(c.category).icon;
            const placed = placedCommitments[c.id];
            return (
              <li key={c.id} className="flex items-center gap-3 py-1.5 pl-4 pr-1.5">
                {Icon && <Icon className="size-4 shrink-0 text-text-secondary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-text">{c.title}</p>
                  <p className="tabular text-small text-text-secondary">
                    {formatDaysLabel(c.days)}
                    {placed && `, ${formatMinutesTo12h(placed.startMins)} to ${formatMinutesTo12h(placed.endMins)}`}
                  </p>
                </div>
                <IconButton label={`Edit ${c.title}`} icon={<Pencil aria-hidden="true" strokeWidth={1.5} className="size-4" />} onClick={() => onEditCommitment(c)} />
                <IconButton label={`Remove ${c.title}`} icon={<X aria-hidden="true" strokeWidth={1.5} className="size-4" />} onClick={() => onRemoveCommitment(c.id)} />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {suggestions.map((preset) => (
          <Button
            key={preset.id}
            variant="secondary"
            size="sm"
            onClick={() => addPreset(preset)}
            leadingIcon={<Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          >
            {preset.title}
          </Button>
        ))}
        {!draft.isOpen && (
          <Button
            variant="quiet"
            size="sm"
            onClick={() => onDraftChange({ ...draft, isOpen: true })}
            leadingIcon={<Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          >
            Add your own
          </Button>
        )}
      </div>

      {draft.isOpen && (
        <form onSubmit={addCustom} className="mt-5 grid animate-rise-in items-end gap-4 sm:grid-cols-[1fr_11rem]">
          <Field label="What is it?">
            <Input
              autoFocus
              value={draft.title}
              onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
              placeholder="Boxing, yoga, study group"
            />
          </Field>
          <Field label="Time" showOptional>
            <Input value={draft.time} onChange={(e) => onDraftChange({ ...draft, time: e.target.value })} placeholder="19:00 - 20:30" />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="secondary" size="sm" disabled={!draft.title.trim()}>
              Add
            </Button>
            <Button variant="quiet" size="sm" onClick={() => onDraftChange(EMPTY_COMMITMENT_DRAFT)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};
