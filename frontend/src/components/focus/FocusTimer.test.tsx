import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FocusTimer } from './FocusTimer';
import '@testing-library/jest-dom/vitest';

describe('FocusTimer', () => {
  afterEach(() => cleanup());
  const props = {
    taskTitle: 'Deep Work Session', secondsRemaining: 1500, totalDurationSeconds: 1800,
    isActive: true, onToggleActive: vi.fn(), onReset: vi.fn(), currentStepIndex: 0, totalSteps: 2,
  };

  it('renders the timer and focused step context', () => {
    render(<FocusTimer {...props} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('In flow')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('handles pause and resume', () => {
    const onToggleActive = vi.fn();
    render(<FocusTimer {...props} onToggleActive={onToggleActive} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onToggleActive).toHaveBeenCalledTimes(1);
  });
  it('handles reset', () => {
    const onReset = vi.fn();
    render(<FocusTimer {...props} isActive={false} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
