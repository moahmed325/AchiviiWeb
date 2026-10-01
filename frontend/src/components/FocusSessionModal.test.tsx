import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { FocusSessionModal } from './FocusSessionModal';
import type { DailyTask } from '../types';
import '@testing-library/jest-dom/vitest';

vi.mock('../lib/audio', () => ({ playSessionStart: vi.fn(), playStepTransition: vi.fn(), playSessionComplete: vi.fn() }));
import { playSessionStart, playStepTransition, playSessionComplete } from '../lib/audio';

describe('FocusSessionModal', () => {
  const sampleTask: DailyTask = {
    id: 'task-1', goalId: 'goal-1', weekNumber: 1, dayNumber: 3, dayOfWeek: 'Wednesday', date: '2026-09-24',
    title: 'Warm-up Run and Cadence Drills', durationMinutes: 30, status: 'pending', isRestDay: false,
    implementationIntention: '', created_at: '2026-09-24T00:00:00.000Z',
    detailedSteps: JSON.stringify([
      { title: 'Light Jog', instructions: 'Jog easily for 10 minutes at conversation pace.', durationMinutes: 10, focusCue: 'Stay tall and relaxed', pitfallToAvoid: 'Do not start too fast', passMark: 'Completed 10 min without stopping' },
      { title: 'Cadence Drills', instructions: 'Perform 4x30-second cadence drills at 180 spm.', durationMinutes: 15, passMark: 'Hit 180 spm on metronome' },
    ]),
  };
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  const renderOpen = (task = sampleTask, onCompleteSession = vi.fn(), onClose = vi.fn()) => render(
    <FocusSessionModal task={task} dayNumber={3} isOpen onClose={onClose} onCompleteSession={onCompleteSession} />,
  );

  it('renders a calm start state without starting the timer', () => {
    renderOpen();
    expect(screen.getByText('Focus')).toBeInTheDocument();
    expect(screen.getByText('Warm-up Run and Cadence Drills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start focused session/i })).toBeInTheDocument();
    expect(playSessionStart).not.toHaveBeenCalled();
  });

  it('starts the timer only after the user starts', () => {
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    expect(screen.getByText('30:00')).toBeInTheDocument();
    expect(screen.getByText('In flow')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    expect(playSessionStart).toHaveBeenCalled();
  });
  it('counts down and supports pause/resume', () => {
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('29:57')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(screen.getByText('Paused')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByText('29:57')).toBeInTheDocument();
    fireEvent.keyDown(window, { code: 'Space' });
    expect(screen.getByText('In flow')).toBeInTheDocument();
  });

  it('moves sequentially through steps and completes', () => {
    renderOpen();
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(playStepTransition).toHaveBeenCalled();
    expect(screen.getByText('Cadence Drills')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));
    expect(playSessionComplete).toHaveBeenCalled();
    expect(screen.getByText('You did the work.')).toBeInTheDocument();
  });

  it('offers the minimum version without adding another card or flow', () => {
    const task = { ...sampleTask, minimumVersion: { stepNumber: 1, title: '10-minute minimum', instructions: 'Do the simplest useful version.', durationMinutes: 10, focusCue: '', pitfallToAvoid: '' } };
    renderOpen(task);
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    fireEvent.click(screen.getByRole('button', { name: /low energy/i }));
    expect(screen.getByText('Minimum version')).toBeInTheDocument();
    expect(screen.getByText('10-minute minimum')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /complete minimum/i }));
    expect(screen.getByText('Minimum complete')).toBeInTheDocument();
  });  it('saves an optional reflection and closes', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderOpen(sampleTask, onComplete, onClose);
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));
    fireEvent.change(screen.getByPlaceholderText('What mattered today?'), { target: { value: 'Great pacing.' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /finish & return/i })));
    expect(onComplete).toHaveBeenCalledWith('Great pacing.');
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the completion state open when saving fails', async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error('offline'));
    const onClose = vi.fn();
    renderOpen(sampleTask, onComplete, onClose);
    fireEvent.click(screen.getByRole('button', { name: /start focused session/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete session/i }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /finish & return/i })));
    expect(screen.getByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes with Escape or the exit control', () => {
    const onClose = vi.fn();
    renderOpen(sampleTask, vi.fn(), onClose);
    fireEvent.click(screen.getByTitle('Exit focus mode (Esc)'));
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
