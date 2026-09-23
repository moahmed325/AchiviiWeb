import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressBar, StepMarker } from './Progress';
import { ErrorState, LoadingState } from './States';

describe('ProgressBar', () => {
  it('exposes its value to assistive tech', () => {
    render(<ProgressBar label="Journey progress" value={27} max={90} valueText="27 of 90 days" showValue />);
    const bar = screen.getByRole('progressbar', { name: 'Journey progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '27');
    expect(bar).toHaveAttribute('aria-valuemax', '90');
    expect(bar).toHaveAttribute('aria-valuetext', '27 of 90 days');
    expect(screen.getByText('27 of 90 days')).toBeInTheDocument();
  });

  it('clamps out-of-range values', () => {
    render(<ProgressBar label="Week" value={140} />);
    expect(screen.getByRole('progressbar', { name: 'Week' })).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('StepMarker', () => {
  it('is announced when labelled', () => {
    render(<StepMarker state="completed" label="Day 12, completed" />);
    expect(screen.getByRole('img', { name: 'Day 12, completed' })).toHaveAttribute('data-state', 'completed');
  });

  it('is decorative without a label', () => {
    const { container } = render(<StepMarker state="destination" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('State primitives', () => {
  it('LoadingState is a polite status with a label', () => {
    render(<LoadingState label="Loading your journey" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your journey');
  });

  it('ErrorState alerts and retries', async () => {
    const onRetry = vi.fn();
    render(<ErrorState description="We couldn't reach the server." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't reach the server.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
