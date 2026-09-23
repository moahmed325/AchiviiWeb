import React, { useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import type { CommitmentItem, RoutineSettings } from '../../types';
import { cx } from '../ui';
import {
  computeDaySchedule,
  formatDaysLabel,
  formatDuration,
  formatMinutesTo12h,
  parseTimeToMinutes,
  type ScheduledDayBlock
} from './schedule';

interface ActivePracticeDrag {
  initialStartMins: number;
  durationMins: number;
  startX: number;
  currentStartMins: number;
}

interface RoutineTimelineProps {
  routine: RoutineSettings;
  /** Where the user last placed practice (drag or tap); null follows the preferred slot. */
  customPracticeStartMins: number | null;
  onPlacePractice: (startMins: number) => void;
  onEditCommitment: (commitment: CommitmentItem) => void;
}

const dayBounds = (routine: RoutineSettings) => {
  const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
  return {
    wakeMins: parseTimeToMinutes(routine.wakeTime, 420),
    sleepMins: parseTimeToMinutes(routine.sleepTime, 1380),
    busyStartMins: parseTimeToMinutes(busyParts[0]?.trim() || '', 540),
    busyEndMins: parseTimeToMinutes(busyParts[1]?.trim() || '', 1020),
  };
};

/** Keeps practice within waking hours and deflects it out of busy hours, to whichever side is nearer. */
const settlePractice = (routine: RoutineSettings, start: number, dur: number) => {
  const { wakeMins, sleepMins, busyStartMins, busyEndMins } = dayBounds(routine);
  let target = Math.max(wakeMins, Math.min(sleepMins - dur, start));
  if (target < busyEndMins && target + dur > busyStartMins) {
    if (target + dur / 2 < (busyStartMins + busyEndMins) / 2) {
      target = Math.max(wakeMins, busyStartMins - dur);
    } else {
      target = Math.min(sleepMins - dur, busyEndMins);
    }
  }
  return target;
};

const BLOCK_STYLE: Record<ScheduledDayBlock['type'], string> = {
  sleep_morning: 'bg-text/[0.04] text-text-secondary',
  sleep_night: 'bg-text/[0.04] text-text-secondary',
  work: 'bg-text/[0.09] text-text-secondary',
  commitment: 'border border-border-strong bg-surface-elevated text-text cursor-pointer hover:border-text/40',
  practice: 'bg-accent text-text-on-inverse',
};

const LEGEND: Array<{ label: string; swatch: string }> = [
  { label: 'Sleep', swatch: 'bg-text/[0.08]' },
  { label: 'Work or study', swatch: 'bg-text/[0.18]' },
  { label: 'Commitments', swatch: 'border border-border-strong bg-surface-elevated' },
  { label: 'Practice', swatch: 'bg-accent' },
];

/** The day, midnight to midnight: drag or tap to place practice, tap a commitment to edit it. */
export const RoutineTimeline: React.FC<RoutineTimelineProps> = ({
  routine,
  customPracticeStartMins,
  onPlacePractice,
  onEditCommitment
}) => {
  const [activePracticeDrag, setActivePracticeDrag] = useState<ActivePracticeDrag | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activePracticeStart = activePracticeDrag
    ? activePracticeDrag.currentStartMins
    : customPracticeStartMins;

  const daySchedule = useMemo(
    () => computeDaySchedule(routine, activePracticeStart),
    [routine, activePracticeStart]
  );

  const freeDiscretionaryMins = useMemo(() => {
    const totalOccupied = daySchedule.allBlocks.reduce((acc, b) => acc + b.durationMins, 0);
    return Math.max(0, 1440 - totalOccupied);
  }, [daySchedule.allBlocks]);

  const handlePracticePointerDown = (e: React.PointerEvent, practiceBlock: ScheduledDayBlock) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best-effort; the drag still works without it.
    }

    setActivePracticeDrag({
      initialStartMins: practiceBlock.startMins,
      durationMins: practiceBlock.durationMins,
      startX: e.clientX,
      currentStartMins: practiceBlock.startMins
    });
  };

  const handlePracticePointerMove = (e: React.PointerEvent) => {
    if (!activePracticeDrag) return;
    e.preventDefault();

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const deltaPixels = e.clientX - activePracticeDrag.startX;
    const deltaMins = Math.round(((deltaPixels / rect.width) * 1440) / 15) * 15;
    const dur = activePracticeDrag.durationMins;
    const proposedStart = Math.round(settlePractice(routine, activePracticeDrag.initialStartMins + deltaMins, dur) / 15) * 15;

    setActivePracticeDrag((prev) => (prev ? { ...prev, currentStartMins: proposedStart } : null));
  };

  const handlePracticePointerUp = (e: React.PointerEvent) => {
    if (!activePracticeDrag) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }

    const finalStart = activePracticeDrag.currentStartMins;
    setActivePracticeDrag(null);
    onPlacePractice(finalStart);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePracticeDrag) return;
    if ((e.target as HTMLElement).closest('[data-no-track-jump]')) {
      return;
    }
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawMins = ratio * 1440;
    const practiceDuration = routine.dailyMinutes || 60;
    const target = Math.round((rawMins - practiceDuration / 2) / 15) * 15;
    onPlacePractice(settlePractice(routine, target, practiceDuration));
  };

  /** Arrow keys move practice by 15 minutes; a step that busy hours would swallow jumps to their far side. */
  const handlePracticeKeyDown = (e: React.KeyboardEvent, block: ScheduledDayBlock) => {
    const { wakeMins, sleepMins, busyStartMins, busyEndMins } = dayBounds(routine);
    const dur = block.durationMins;
    const deltas: Record<string, number> = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 };
    let target: number;
    if (e.key === 'Home') target = wakeMins;
    else if (e.key === 'End') target = sleepMins - dur;
    else if (e.key in deltas) {
      const delta = deltas[e.key];
      const raw = block.startMins + delta;
      target = settlePractice(routine, raw, dur);
      const blockedByBusyHours = raw >= wakeMins && raw <= sleepMins - dur && Math.sign(target - block.startMins) !== Math.sign(delta);
      if (blockedByBusyHours) target = delta > 0 ? busyEndMins : busyStartMins - dur;
    } else return;
    e.preventDefault();
    const settled = settlePractice(routine, target, dur);
    if (settled !== block.startMins) onPlacePractice(settled);
  };

  const practiceSummary =
    routine.dailyMinutes > 0
      ? `${daySchedule.practiceTimeLabel}, ${routine.dailyMinutes} min`
      : 'Choose how long each day to place your practice';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-body font-medium text-text">
          {routine.dailyMinutes > 0 && <span className="text-text-secondary">Practice: </span>}
          {practiceSummary}
        </p>
        <p className="tabular text-small text-text-secondary">About {formatDuration(freeDiscretionaryMins)} free</p>
      </div>

      <div>
        <div
          ref={timelineRef}
          role="group"
          aria-label="Your day, from midnight to midnight"
          onClick={handleTimelineClick}
          className="relative h-16 w-full cursor-pointer touch-pan-y select-none rounded-card border border-border bg-background"
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-card">
            {['left-1/4', 'left-1/2', 'left-3/4'].map((position) => (
              <div key={position} className={cx('absolute inset-y-0 w-px bg-border', position)} />
            ))}
          </div>

          {daySchedule.allBlocks.map((b) => {
            const isPractice = b.isPractice;
            if (isPractice && !routine.dailyMinutes) return null;
            const isDraggingPractice = isPractice && !!activePracticeDrag;

            const startMins = isDraggingPractice ? activePracticeDrag.currentStartMins : b.startMins;
            const endMins = isDraggingPractice ? activePracticeDrag.currentStartMins + b.durationMins : b.endMins;
            const leftPct = (startMins / 1440) * 100;
            const widthPct = Math.max(2.6, (b.durationMins / 1440) * 100);
            const BlockIcon = b.icon;
            const range = `${formatMinutesTo12h(startMins)} to ${formatMinutesTo12h(endMins)}`;

            if (isPractice) {
              const { wakeMins, sleepMins } = dayBounds(routine);
              return (
                <div
                  key={b.id}
                  data-no-track-jump="true"
                  role="slider"
                  tabIndex={0}
                  aria-label="Practice time"
                  aria-valuemin={wakeMins}
                  aria-valuemax={Math.max(wakeMins, sleepMins - b.durationMins)}
                  aria-valuenow={startMins}
                  aria-valuetext={range}
                  onPointerDown={(e) => handlePracticePointerDown(e, b)}
                  onPointerMove={handlePracticePointerMove}
                  onPointerUp={handlePracticePointerUp}
                  onPointerCancel={handlePracticePointerUp}
                  onKeyDown={(e) => handlePracticeKeyDown(e, b)}
                  className={cx(
                    'focus-ring absolute inset-y-1 z-20 flex cursor-grab touch-none items-center justify-center rounded-control active:cursor-grabbing',
                    // A wider invisible hit area than the block, so a short session is still easy to grab.
                    "before:absolute before:-inset-x-3 before:-inset-y-1 before:content-['']",
                    BLOCK_STYLE.practice,
                    isDraggingPractice ? 'z-40 ring-2 ring-text' : 'transition-[left,width] duration-(--duration-base) ease-ascend'
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  {isDraggingPractice && (
                    <div className="pointer-events-none absolute -top-11 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-text px-3 py-1 text-small font-medium text-text-on-inverse shadow-overlay">
                      <span className="tabular">{range}</span>
                    </div>
                  )}
                  <GripVertical aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
                </div>
              );
            }

            return (
              <div
                key={b.id}
                aria-hidden="true"
                data-no-track-jump="true"
                onClick={() => {
                  if (b.type === 'commitment') {
                    const found = (routine.commitments || []).find((c) => c.id === b.id);
                    if (found) onEditCommitment(found);
                  }
                }}
                className={cx(
                  'absolute inset-y-1 z-10 flex items-center justify-center overflow-hidden rounded-block transition-[left,width] duration-(--duration-base) ease-ascend',
                  b.type !== 'commitment' && 'cursor-default',
                  BLOCK_STYLE[b.type]
                )}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={
                  b.type === 'commitment'
                    ? `${b.title}, ${range}${b.days ? `, ${formatDaysLabel(b.days)}` : ''}. Tap to edit.`
                    : `${b.title}, ${range}`
                }
              >
                <span className="flex min-w-0 items-center gap-1.5 px-2">
                  {BlockIcon && <BlockIcon className="size-3.5 shrink-0" />}
                  <span className="hidden truncate text-micro sm:inline">{b.title}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div aria-hidden="true" className="tabular mt-2 flex justify-between font-ui-mono text-micro text-text-secondary">
          <span>12 AM</span>
          <span>6 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-2 text-small text-text-secondary">
            <span aria-hidden="true" className={cx('size-3 rounded-block', item.swatch)} />
            {item.label}
          </span>
        ))}
      </div>
      <p className="text-small text-text-secondary">
        Drag the practice block or tap the timeline to move it. With a keyboard, focus the block and use the arrow keys. Tap a commitment to edit it.
      </p>
    </div>
  );
};
