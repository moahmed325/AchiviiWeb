import React from 'react';
import { CheckCircle2, Clock, RotateCcw, Target } from 'lucide-react';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { cx } from '../ui/cx';
import type { WeekTarget, WeekTest, WeeklyTestResult } from '../../types';
import { formatPassIf, formatTarget } from '../../lib/formatters';

export interface ReviewTestResultStepProps {
  target?: WeekTarget | null;
  test?: WeekTest | null;
  testResult: WeeklyTestResult | null;
  onChange: (result: WeeklyTestResult | null) => void;
  disabled?: boolean;
}

/**
 * Honest Weekly Benchmark Test & Target Comparison Step (Phase 7 — BP §17, §33, §43, OD-1a).
 * Enables the user to record their actual test result and compare it directly with the
 * week's target deliverable or metric in an encouraging, non-punitive environment.
 */
export const ReviewTestResultStep: React.FC<ReviewTestResultStepProps> = ({
  target,
  test,
  testResult,
  onChange,
  disabled = false,
}) => {
  // If neither target nor benchmark test instructions exist for this week, render nothing
  if (!target && !test) {
    return null;
  }

  const defaultUnit = target?.kind === 'number' ? target.unit : undefined;
  const currentPassed = testResult?.passed ?? true;
  const currentValue = testResult?.value ?? '';
  const currentNote = testResult?.note ?? '';
  const hasEntry = Boolean(testResult && String(testResult.value).trim() !== '');

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      onChange(null);
      return;
    }

    // Auto-detect number if pure digits/decimal
    const parsedNumber = Number(val);
    const resolvedValue = !Number.isNaN(parsedNumber) && val.trim() !== '' ? parsedNumber : val;

    // Suggest passed value if numeric comparison is straightforward
    let suggestedPassed = testResult?.passed ?? true;
    if (target?.kind === 'number' && typeof resolvedValue === 'number') {
      if (target.direction === 'lower_is_better') {
        suggestedPassed = resolvedValue <= target.value;
      } else {
        suggestedPassed = resolvedValue >= target.value;
      }
    }

    onChange({
      value: resolvedValue,
      unit: defaultUnit,
      passed: suggestedPassed,
      note: currentNote || undefined,
    });
  };

  const handlePassedChange = (passed: boolean) => {
    onChange({
      value: currentValue || (target?.kind === 'number' ? target.value : 'Completed'),
      unit: defaultUnit,
      passed,
      note: currentNote || undefined,
    });
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!testResult) return;
    onChange({
      ...testResult,
      note: e.target.value,
    });
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="rounded-card border border-border bg-surface p-5 space-y-4 sm:p-6 text-left">
      {/* Benchmark Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
          <Target aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-accent shrink-0" />
          <span>Weekly Benchmark</span>
        </div>
        <h3 className="text-body font-semibold text-text">
          {test?.instructions || (target ? formatTarget(target) : 'Benchmark Evaluation')}
        </h3>
        {test?.passIf && (
          <p className="text-small text-text-secondary">
            {formatPassIf(test.passIf)}
          </p>
        )}
      </div>

      {/* Target Glance */}
      {target && (
        <div className="flex items-start justify-between gap-3 rounded-control border border-border/60 bg-background/50 px-3.5 py-2.5 text-small">
          <span className="text-text-secondary shrink-0 font-medium">Target Deliverable</span>
          <span className="font-semibold text-text text-right tabular-nums">
            {formatTarget(target)}
          </span>
        </div>
      )}

      {/* Result Entry Controls */}
      <div className="space-y-3.5 pt-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Result Value */}
          <Field
            id="review-test-value"
            label="Your result"
            hint={defaultUnit ? `Unit: ${defaultUnit}` : undefined}
          >
            <Input
              name="review-test-value"
              type="text"
              value={currentValue}
              onChange={handleValueChange}
              placeholder={target?.kind === 'number' ? `e.g. ${target.value}` : 'e.g. Completed brief'}
              disabled={disabled}
              className="tabular-nums"
            />
          </Field>

          {/* Target Met Outcome */}
          <div className="space-y-1.5">
            <span className="block text-small font-medium text-text">Outcome</span>
            <div className="flex items-center gap-2" role="group" aria-label="Benchmark outcome">
              <Button
                type="button"
                variant={hasEntry && currentPassed ? 'primary' : 'secondary'}
                onClick={() => handlePassedChange(true)}
                disabled={disabled}
                className={cx(
                  'flex-1 min-h-[44px] justify-center',
                  hasEntry && currentPassed
                    ? 'border-accent bg-accent text-surface'
                    : 'border-border text-text-secondary hover:text-text'
                )}
                leadingIcon={<CheckCircle2 aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />}
              >
                Met target
              </Button>
              <Button
                type="button"
                variant={hasEntry && !currentPassed ? 'primary' : 'secondary'}
                onClick={() => handlePassedChange(false)}
                disabled={disabled}
                className={cx(
                  'flex-1 min-h-[44px] justify-center',
                  hasEntry && !currentPassed
                    ? 'border-caution/50 bg-caution/15 text-caution font-medium'
                    : 'border-border text-text-secondary hover:text-text'
                )}
                leadingIcon={<Clock aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />}
              >
                In progress
              </Button>
            </div>
          </div>
        </div>

        {/* Optional Context Note */}
        {hasEntry && (
          <Field
            id="review-test-note"
            label="Observation or context (optional)"
          >
            <Input
              name="review-test-note"
              type="text"
              value={currentNote}
              onChange={handleNoteChange}
              placeholder="e.g. Felt relaxed, pacing was steady..."
              disabled={disabled}
            />
          </Field>
        )}
      </div>

      {/* Honest Comparison Summary (BP §17, §33) */}
      {hasEntry && (
        <div
          data-testid="target-comparison-summary"
          className={cx(
            'rounded-control border p-3 text-small space-y-1 transition-colors',
            currentPassed
              ? 'border-accent/30 bg-accent/5 text-text'
              : 'border-caution/30 bg-caution/5 text-text'
          )}
        >
          <div className="flex items-center justify-between font-medium">
            <span>Result vs Target</span>
            <span
              className={cx(
                'text-micro font-semibold uppercase tracking-wider',
                currentPassed ? 'text-accent' : 'text-caution'
              )}
            >
              {currentPassed ? 'Target Achieved' : 'In Progress'}
            </span>
          </div>
          <p className="text-small text-text-secondary leading-relaxed">
            {currentPassed
              ? 'Benchmark met! Your consistent practice is translating directly into performance.'
              : 'Adapt the journey, don’t punish the person. Next week will adapt to consolidate this benchmark.'}
          </p>
        </div>
      )}

      {/* Clear Action */}
      {hasEntry && (
        <div className="pt-1 flex justify-end">
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
            className="text-micro text-text-muted hover:text-text-secondary"
            leadingIcon={<RotateCcw aria-hidden="true" strokeWidth={1.5} className="size-3" />}
          >
            Clear benchmark entry
          </Button>
        </div>
      )}
    </div>
  );
};

export default ReviewTestResultStep;
