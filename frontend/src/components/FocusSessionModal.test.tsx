import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FocusSessionModal } from './FocusSessionModal';
import type { DailyTask } from '../types';

vi.mock('../lib/audio', () => ({
  playSessionStart: vi.fn(),
  playStepTransition: vi.fn(),
  playSessionComplete: vi.fn(),
}));

import { playSessionStart, playStepTransition, playSessionComplete } from '../lib/audio';

describe('FocusSessionModal', () => {
  const sampleTask: DailyTask = {
    id: 'task-1',
    goalId: 'goal-1',
    weekNumber: 1,
    dayNumber: 3,
    dayOfWeek: 'Wednesday',
    date: '2026-09-24',
    title: 'Warm-up Run and Cadence Drills',
    durationMinutes: 30,
    status: 'pending',
    isRestDay: false,
    implementationIntention: '',
    created_at: '2026-09-24T00:00:00.000Z',
    detailedSteps: JSON.stringify([
      {
        title: 'Light Jog',
        instructions: 'Jog easily for 10 minutes at conversation pace.',
        durationMinutes: 10,
        focusCue: 'Stay tall and relaxed',
        pitfallToAvoid: 'Do not start too fast',
        output: 'Elevated heart rate',
        passMark: 'Completed 10 min without stopping',
        timing: 'First 10 mins',
      },
      {
        title: 'Cadence Drills',
        instructions: 'Perform 4x30-second cadence drills at 180 spm.',
        durationMinutes: 15,
        output: 'Target cadence verified',
        passMark: 'Hit 180 spm on metronome',
      },
    ]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={false}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders header, initial timer, step runner, and plays start audio when opened', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    expect(screen.getByText('Day 3 of 90 • Focus Mode')).toBeInTheDocument();
    expect(screen.getByText('30m deliberate practice')).toBeInTheDocument();
    expect(screen.getByText('Warm-up Run and Cadence Drills')).toBeInTheDocument();
    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByText('In Flow')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Light Jog')).toBeInTheDocument();
    expect(playSessionStart).toHaveBeenCalled();
  });

  it('counts down active timer second by second', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    expect(screen.getByText('30:00')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('29:57')).toBeInTheDocument();
  });

  it('toggles pause and resume with button and spacebar', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    // Click pause button
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseButton);
    expect(screen.getByText('Paused')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Remains paused at 30:00
    expect(screen.getByText('30:00')).toBeInTheDocument();

    // Press Space on window to resume
    fireEvent.keyDown(window, { code: 'Space' });
    expect(screen.getByText('In Flow')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('29:58')).toBeInTheDocument();
  });

  it('resets timer duration and pauses when reset button is clicked', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText('29:50')).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: /reset timer/i });
    fireEvent.click(resetButton);

    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
  });

  it('navigates through steps and toggles tips', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    // Tips toggle
    const tipsButton = screen.getByRole('button', { name: /view tips & guidance/i });
    fireEvent.click(tipsButton);
    expect(screen.getAllByText('Stay tall and relaxed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Do not start too fast')).toBeInTheDocument();

    // Previous is disabled on first step
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    // Next step
    const nextButton = screen.getByRole('button', { name: /next step/i });
    fireEvent.click(nextButton);

    expect(playStepTransition).toHaveBeenCalled();
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Cadence Drills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /complete session/i })).toBeInTheDocument();

    // Previous step
    const prevButton = screen.getByRole('button', { name: /previous/i });
    expect(prevButton).not.toBeDisabled();
    fireEvent.click(prevButton);
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
  });

  it('triggers celebration screen when completing final step', () => {
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    // Step 2 -> Complete Session
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));

    expect(playSessionComplete).toHaveBeenCalled();
    expect(screen.getByText('Deliberate Practice Complete')).toBeInTheDocument();
    expect(screen.getByText('Day 3 Mastered')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('Day 3 / 90')).toBeInTheDocument();
  });

  it('submits reflection note and closes modal on save', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={onClose}
        onCompleteSession={onComplete}
      />,
    );

    // Move to celebration
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));

    // Type reflection
    const textarea = screen.getByPlaceholderText('What was your breakthrough today?');
    fireEvent.change(textarea, { target: { value: 'Maintained strong form throughout' } });

    // Click Save & Return
    const saveButton = screen.getByRole('button', { name: /save & return to dashboard/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(onComplete).toHaveBeenCalledWith('Maintained strong form throughout');
    expect(onClose).toHaveBeenCalled();
  });

  it('surfaces error alert and keeps modal open with reflection note intact when write fails', async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error('Network offline'));
    const onClose = vi.fn();

    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={onClose}
        onCompleteSession={onComplete}
      />,
    );

    // Move to celebration
    fireEvent.click(screen.getByRole('button', { name: /next step/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));

    // Type reflection
    const textarea = screen.getByPlaceholderText('What was your breakthrough today?');
    fireEvent.change(textarea, { target: { value: 'Paced cadence smoothly' } });

    // Submit save
    const saveButton = screen.getByRole('button', { name: /save & return to dashboard/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    // Modal did NOT close
    expect(onClose).not.toHaveBeenCalled();

    // Error alert is visible
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("That didn't save. Please try again.");

    // Reflection note is intact
    expect(textarea).toHaveValue('Paced cadence smoothly');

    // Button re-enabled as "Try again"
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    // Now let onComplete succeed on retry
    onComplete.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(retryButton);
    });

    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key and on Exit button click', () => {
    const onClose = vi.fn();
    render(
      <FocusSessionModal
        task={sampleTask}
        dayNumber={3}
        isOpen={true}
        onClose={onClose}
        onCompleteSession={vi.fn()}
      />,
    );

    const closeButton = screen.getByTitle('Exit focus mode (Esc)');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders fallback card when detailedSteps is empty', () => {
    const emptyStepsTask: DailyTask = {
      ...sampleTask,
      detailedSteps: '',
    };

    render(
      <FocusSessionModal
        task={emptyStepsTask}
        dayNumber={3}
        isOpen={true}
        onClose={vi.fn()}
        onCompleteSession={vi.fn()}
      />,
    );

    expect(screen.getByText(/focus on the primary deliberate practice outcome/i)).toBeInTheDocument();
    const completeButton = screen.getByRole('button', { name: /complete practice session/i });
    fireEvent.click(completeButton);
    expect(screen.getByText('Deliberate Practice Complete')).toBeInTheDocument();
  });
});
