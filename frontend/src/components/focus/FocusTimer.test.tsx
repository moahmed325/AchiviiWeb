import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusTimer } from './FocusTimer';

describe('FocusTimer Component (M11.3)', () => {
  const sampleSteps = [
    {
      stepNumber: 1,
      title: 'Step 1',
      instructions: 'Instructions 1',
      durationMinutes: 10,
      focusCue: 'Stay centered',
      pitfallToAvoid: 'Rushing',
    },
    {
      stepNumber: 2,
      title: 'Step 2',
      instructions: 'Instructions 2',
      durationMinutes: 20,
      focusCue: 'Keep pace',
      pitfallToAvoid: 'Losing focus',
    },
  ];

  it('renders task title, formatted time, and hides desktop keyboard hint on mobile', () => {
    render(
      <FocusTimer
        taskTitle="Deep Work Session"
        secondsRemaining={1500}
        totalDurationSeconds={1800}
        isActive={true}
        onToggleActive={vi.fn()}
        onReset={vi.fn()}
        steps={sampleSteps}
        currentStepIndex={0}
        onSelectStep={vi.fn()}
      />,
    );

    expect(screen.getByText('Deep Work Session')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('In Flow')).toBeInTheDocument();

    // Check keyboard hint contains hidden sm:block
    const hint = screen.getByText(/Press/i);
    expect(hint).toHaveClass('hidden');
    expect(hint).toHaveClass('sm:block');
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
        steps={sampleSteps}
        currentStepIndex={0}
        onSelectStep={vi.fn()}
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
        steps={sampleSteps}
        currentStepIndex={0}
        onSelectStep={vi.fn()}
      />,
    );

    expect(screen.getByText('Paused')).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
