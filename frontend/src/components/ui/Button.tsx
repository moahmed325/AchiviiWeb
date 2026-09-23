import React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'premium' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'focus-ring group relative inline-flex items-center justify-center gap-2 rounded-full font-ui font-medium tracking-[-0.01em] ' +
  'whitespace-nowrap select-none cursor-pointer ' +
  'transition-[background-color,border-color,color,opacity,transform] duration-(--duration-base) ease-ascend ' +
  'active:scale-[0.985] disabled:active:scale-100 aria-disabled:active:scale-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-45 aria-busy:cursor-progress';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-text text-text-on-inverse hover:bg-white',
  secondary: 'border border-border-strong text-text hover:border-text/40 hover:bg-text/[0.04]',
  quiet: 'text-text-secondary hover:text-text hover:bg-text/[0.04]',
  premium: 'border border-achievement/40 text-achievement hover:border-achievement/70 hover:bg-achievement/[0.06]',
  danger: 'border border-danger/40 text-danger hover:border-danger/70 hover:bg-danger/[0.06]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-small',
  md: 'min-h-12 px-6 text-body',
  lg: 'min-h-14 px-8 text-body-lg',
};

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cx('size-4 animate-spin', className)}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export interface ButtonProps extends React.ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Shows a spinner, sets aria-busy and blocks clicks (including form submission). The label stays visible and the
   * button keeps focus, because it uses aria-disabled rather than the native disabled attribute.
   */
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  /** Renders the single child (for example a router Link) with button styling. `disabled` and `loading` still apply. */
  asChild?: boolean;
}

/** Blocks activation while busy or (for non-button elements) disabled, without removing the element from the tab order. */
const guardClick = <E extends HTMLElement>(blocked: boolean, onClick?: React.MouseEventHandler<E>) =>
  (event: React.MouseEvent<E>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  asChild = false,
  disabled = false,
  type,
  onClick,
  className,
  children,
  ...rest
}) => {
  const Comp: React.ElementType = asChild ? Slot : 'button';
  const blocked = loading || (asChild && disabled);
  const handleClick = guardClick(blocked, onClick);
  return (
    <Comp
      {...(asChild ? {} : { type: type ?? 'button', disabled: disabled && !loading })}
      aria-busy={loading || undefined}
      aria-disabled={blocked || undefined}
      onClick={handleClick}
      className={cx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner /> : leadingIcon}
      <Slottable>{children}</Slottable>
      {trailingIcon}
    </Comp>
  );
};

export interface IconButtonProps extends Omit<React.ComponentProps<'button'>, 'children' | 'aria-label'> {
  /** Accessible name. Required: an icon alone has no text. */
  label: string;
  icon: React.ReactNode;
  variant?: 'quiet' | 'secondary';
  /** Replaces the icon with a spinner and blocks clicks; keeps focus like Button. */
  loading?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  icon,
  variant = 'quiet',
  loading = false,
  disabled = false,
  type,
  onClick,
  className,
  ...rest
}) => {
  const handleClick = guardClick(loading, onClick);
  return (
    <button
      type={type ?? 'button'}
      aria-label={label}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      disabled={disabled && !loading}
      onClick={handleClick}
      className={cx(
        'focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full cursor-pointer',
        'transition-[background-color,border-color,color] duration-(--duration-quick) disabled:cursor-not-allowed disabled:opacity-45 aria-busy:cursor-progress',
        variant === 'quiet'
          ? 'text-text-secondary hover:bg-text/[0.06] hover:text-text'
          : 'border border-border-strong text-text hover:border-text/40 hover:bg-text/[0.04]',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : icon}
    </button>
  );
};
