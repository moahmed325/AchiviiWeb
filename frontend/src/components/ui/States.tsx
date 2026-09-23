import React from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from './Button';
import { cx } from './cx';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** One clear next step, usually a Button. */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cx('flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-12 text-center', className)}>
    {icon && <span className="mb-1 text-text-secondary">{icon}</span>}
    <p className="text-h3 text-text">{title}</p>
    {description && <p className="max-w-md text-small text-text-secondary">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cx('animate-pulse rounded-block bg-text/[0.06]', className)} />
);

export interface LoadingStateProps {
  /** Announced to screen readers; shown when showLabel is set. */
  label?: string;
  showLabel?: boolean;
  /** Skeleton shapes matching the content being loaded. Defaults to three lines. */
  children?: React.ReactNode;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading', showLabel = false, children, className }) => (
  <div role="status" aria-live="polite" className={cx('flex flex-col gap-3', className)}>
    <span className={showLabel ? 'text-small text-text-secondary' : 'sr-only'}>{label}</span>
    {children ?? (
      <>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </>
    )}
  </div>
);

export interface ErrorStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}

/** Calm and specific: say what happened and what to do next. Never blame the user. */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description,
  onRetry,
  retryLabel = 'Try again',
  retrying = false,
  className,
}) => (
  <div role="alert" className={cx('flex flex-col items-start gap-3 rounded-card border border-danger/30 bg-danger/[0.05] p-5 sm:p-6', className)}>
    <p className="text-body font-medium text-text">{title}</p>
    {description && <p className="text-small text-text-secondary">{description}</p>}
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        loading={retrying}
        leadingIcon={<RotateCw aria-hidden="true" strokeWidth={1.75} className="size-4" />}
        className="mt-1"
      >
        {retryLabel}
      </Button>
    )}
  </div>
);
