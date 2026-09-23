import React, { createContext, useContext, useId } from 'react';
import { Check } from 'lucide-react';
import { ErrorMessage } from './Field';
import { cx } from './cx';

/*
 * All choice controls are native inputs, visually hidden, so keyboard, forms and screen readers behave natively.
 * Group errors follow the GOV.UK pattern: the message is linked from the fieldset and announced when it appears.
 * Focus outlines read --focus-ring-color so they adapt inside .on-inverse.
 */

const focusWithin = 'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring-color)';

export interface CheckboxProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Marks the checkbox invalid and shows the message beneath it. */
  error?: React.ReactNode;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, description, error, className, id, ...props }) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const labelId = `${inputId}-label`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="group relative flex min-h-11 cursor-pointer items-start gap-3 py-2 has-disabled:cursor-not-allowed has-disabled:opacity-50"
      >
        <input
          id={inputId}
          type="checkbox"
          aria-labelledby={labelId}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden="true"
          className={cx(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-block border bg-surface text-text-on-inverse',
            'transition-colors duration-(--duration-quick) group-hover:border-text-secondary',
            error ? 'border-danger' : 'border-border-control',
            'peer-checked:border-accent peer-checked:bg-accent',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus-ring-color)',
            '[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100',
          )}
        >
          <Check strokeWidth={2.5} className="size-3.5 transition-opacity duration-(--duration-quick)" />
        </span>
        <span className="flex flex-col gap-0.5">
          <span id={labelId} className="text-body leading-snug text-text">
            {label}
          </span>
          {description && (
            <span id={descriptionId} className="text-small text-text-secondary">
              {description}
            </span>
          )}
        </span>
      </label>
      <ErrorMessage id={errorId} className="pl-8 [&>p]:mt-0">
        {error}
      </ErrorMessage>
    </div>
  );
};

interface ChoiceGroupContextValue {
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  required: boolean;
  invalid: boolean;
}

const ChoiceGroupContext = createContext<ChoiceGroupContextValue | null>(null);

export interface ChoiceGroupProps {
  legend: React.ReactNode;
  description?: React.ReactNode;
  /** Hides the legend visually; it stays available to screen readers. */
  hideLegend?: boolean;
  name?: string;
  value: string | undefined;
  onChange: (value: string) => void;
  /** Sets the native required attribute on every option. */
  required?: boolean;
  /** Shown under the options, linked to the group and announced. Unchecked cards take a danger border. */
  error?: React.ReactNode;
  columns?: 1 | 2 | 3;
  className?: string;
  children: React.ReactNode;
}

/** A radio group of ChoiceCards, for choosing one option such as a pathway or a daily time budget. */
export const ChoiceGroup: React.FC<ChoiceGroupProps> = ({
  legend,
  description,
  hideLegend = false,
  name,
  value,
  onChange,
  required = false,
  error,
  columns = 1,
  className,
  children,
}) => {
  const autoName = useId();
  const baseId = useId();
  const descriptionId = description ? `${baseId}-description` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  return (
    <fieldset className={cx('min-w-0', className)} aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}>
      <legend className={cx(hideLegend ? 'sr-only' : 'mb-1 text-small font-medium text-text')}>{legend}</legend>
      {description && (
        <p id={descriptionId} className="mb-3 text-small text-text-secondary">
          {description}
        </p>
      )}
      <ChoiceGroupContext.Provider value={{ name: name ?? autoName, value, onChange, required, invalid: Boolean(error) }}>
        <div className={cx('grid gap-3', !hideLegend && !description && 'mt-2', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3')}>
          {children}
        </div>
      </ChoiceGroupContext.Provider>
      <ErrorMessage id={errorId}>{error}</ErrorMessage>
    </fieldset>
  );
};

export interface ChoiceCardProps {
  value: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Small trailing detail, for example "30 min a day". */
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const ChoiceCard: React.FC<ChoiceCardProps> = ({ value, title, description, meta, icon, disabled, className }) => {
  const group = useContext(ChoiceGroupContext);
  const id = useId();
  if (!group) throw new Error('ChoiceCard must be used inside a ChoiceGroup');
  const describedBy = [description && `${id}-description`, meta && `${id}-meta`].filter(Boolean).join(' ') || undefined;
  return (
    <label
      className={cx(
        'group relative flex min-h-11 cursor-pointer items-start gap-4 rounded-card border bg-surface p-4 sm:p-5',
        'transition-colors duration-(--duration-quick)',
        group.invalid ? 'border-danger/50 hover:border-danger' : 'border-border hover:border-border-strong',
        'has-checked:border-accent has-checked:bg-accent/[0.06]',
        focusWithin,
        'has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
    >
      <input
        type="radio"
        className="sr-only"
        name={group.name}
        value={value}
        checked={group.value === value}
        onChange={() => group.onChange(value)}
        disabled={disabled}
        required={group.required}
        aria-labelledby={`${id}-title`}
        aria-describedby={describedBy}
      />
      {icon && <span className="mt-0.5 shrink-0 text-text-secondary group-has-checked:text-accent-hover">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span id={`${id}-title`} className="text-body font-medium leading-snug text-text">
          {title}
        </span>
        {description && (
          <span id={`${id}-description`} className="text-small text-text-secondary">
            {description}
          </span>
        )}
        {meta && (
          <span id={`${id}-meta`} className="tabular mt-1 font-ui-mono text-micro uppercase text-text-secondary">
            {meta}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-control transition-colors group-has-checked:border-accent"
      >
        <span className="size-2.5 rounded-full bg-accent opacity-0 transition-opacity group-has-checked:opacity-100" />
      </span>
    </label>
  );
};

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  legend: React.ReactNode;
  hideLegend?: boolean;
  name?: string;
  options: SegmentedOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  /** Shown under the control, linked to the group and announced. */
  error?: React.ReactNode;
  className?: string;
}

/** Two to four short, mutually exclusive options, for example "Morning / Evening". */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  legend,
  hideLegend = false,
  name,
  options,
  value,
  onChange,
  required = false,
  error,
  className,
}) => {
  const autoName = useId();
  const baseId = useId();
  const errorId = `${baseId}-error`;
  return (
    <fieldset className={cx('min-w-0', className)} aria-describedby={error ? errorId : undefined}>
      <legend className={cx(hideLegend ? 'sr-only' : 'mb-2 text-small font-medium text-text')}>{legend}</legend>
      <div className={cx('flex w-full gap-1 rounded-full border bg-surface p-1', error ? 'border-danger' : 'border-border-strong')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              'relative flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-full px-3 text-center text-small font-medium text-text-secondary sm:px-4',
              'transition-colors duration-(--duration-quick) hover:text-text',
              'has-checked:bg-text has-checked:text-text-on-inverse',
              focusWithin,
              'has-disabled:cursor-not-allowed has-disabled:opacity-45',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name ?? autoName}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={option.disabled}
              required={required}
            />
            {option.label}
          </label>
        ))}
      </div>
      <ErrorMessage id={error ? errorId : undefined}>{error}</ErrorMessage>
    </fieldset>
  );
};
