import React, { createContext, useContext, useId } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { cx } from './cx';

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * An error message inside a live region that is always mounted, so screen readers announce the message when it
 * appears. Used by Field and by the choice controls.
 */
export const ErrorMessage: React.FC<{ id?: string; className?: string; children?: React.ReactNode }> = ({ id, className, children }) => (
  <div aria-live="polite" className={className}>
    {children && (
      <p id={id} className="mt-2 flex items-start gap-1.5 text-small text-danger">
        <AlertCircle aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0" />
        <span>{children}</span>
      </p>
    )}
  </div>
);

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** When set, the control is marked invalid, the message is linked to it and it is announced. */
  error?: React.ReactNode;
  required?: boolean;
  /** Shows "(optional)" after the label when the field isn't required. */
  showOptional?: boolean;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

/** Labels one control (Input, Textarea or Select) and wires its id, hint and error for assistive tech. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, required = false, showOptional = false, id, className, children }) => {
  const autoId = useId();
  const controlId = id ?? autoId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('flex flex-col', className)}>
      <label htmlFor={controlId} className="mb-2 text-small font-medium text-text">
        {label}
        {!required && showOptional && <span className="font-normal text-text-secondary"> (optional)</span>}
      </label>
      <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>{children}</FieldContext.Provider>
      {hint && (
        <p id={hintId} className="mt-2 text-small text-text-secondary">
          {hint}
        </p>
      )}
      <ErrorMessage id={errorId}>{error}</ErrorMessage>
    </div>
  );
};

const useFieldControl = (props: { id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid'] }) => {
  const field = useContext(FieldContext);
  return {
    id: props.id ?? field?.id,
    required: props.required ?? field?.required,
    'aria-describedby': [field?.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field?.invalid || undefined),
  };
};

/* 16px text so iOS Safari doesn't zoom on focus. border-control keeps the boundary at 3:1 or better. */
const control =
  'focus-ring w-full rounded-control border border-border-control bg-surface font-ui text-body text-text ' +
  'placeholder:text-text-muted transition-colors duration-(--duration-quick) ' +
  'hover:border-text-secondary focus-visible:border-accent aria-[invalid=true]:border-danger ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends React.ComponentProps<'input'> {
  /** A control inside the right edge, for example an IconButton that shows or hides a password. */
  trailing?: React.ReactNode;
}

/** `className` goes to the outermost element: the input itself, or its wrapper when `trailing` is set. */
export const Input: React.FC<InputProps> = ({ className, trailing, ...props }) => {
  const wiring = useFieldControl(props);
  const input = <input {...props} {...wiring} className={cx(control, 'min-h-12 px-4', trailing ? 'pr-13' : className)} />;
  if (!trailing) return input;
  return (
    <div className={cx('relative', className)}>
      {input}
      <div className="absolute inset-y-0 right-0.5 flex items-center">{trailing}</div>
    </div>
  );
};

export const Textarea: React.FC<React.ComponentProps<'textarea'>> = ({ className, rows = 4, ...props }) => {
  const wiring = useFieldControl(props);
  return <textarea {...props} {...wiring} rows={rows} className={cx(control, 'min-h-28 resize-y px-4 py-3 leading-relaxed', className)} />;
};

/** Native select: the platform picker is the most usable option on mobile. `className` goes to the wrapper. */
export const Select: React.FC<React.ComponentProps<'select'>> = ({ className, children, ...props }) => {
  const wiring = useFieldControl(props);
  return (
    <div className={cx('relative', className)}>
      <select {...props} {...wiring} className={cx(control, 'min-h-12 cursor-pointer appearance-none pl-4 pr-11')}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" strokeWidth={1.5} className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
    </div>
  );
};
