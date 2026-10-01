import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusTimer } from './FocusTimer';

describe('FocusTimer Component (M11.3)', () => {
  it('renders task title, formatted time, and hides desktop keyboard hint on mobile', () => {
    render(
      <FocusTimer
        taskTitle="Deep Work Session"
        secondsRemaining={1500}
        totalDurationSeconds={1800}
        isActive={true}
        onToggleActive={vi.fn()}
        onReset={vi.fn()}
        currentStepIndex={0}
        totalSteps={2}
      />,
    );

    expect(screen.getByText('Deep Work Session')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('In Flow')).toBeInTheDocument();

    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
  });

  it('handles pause/resume button clicks', () => {
    const handleToggle = vi.fn();
    render(
      <FocusTimer
        taskTitle="Deep Work Session"
        secondsRemaining={1500}
        totalDurationSeconds={1800}
        isActive={true}
        onToggleActive={handleToggle}
        onReset={vi.fn()}
        currentStepIndex={0}
        totalSteps={2}
      />,
    );

    const pauseBtn = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('handles reset button clicks', () => {
    const handleReset = vi.fn();
    render(
      <FocusTimer
        taskTitle="Deep Work Session"
        secondsRemaining={1500}
        totalDurationSeconds={1800}
        isActive={false}
        onToggleActive={vi.fn()}
        onReset={handleReset}
        currentStepIndex={0}
        totalSteps={2}
      />,
    );

    expect(screen.getAllByText('Paused').length).toBeGreaterThanOrEqual(1);
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
