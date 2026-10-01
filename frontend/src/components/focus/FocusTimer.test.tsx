import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FocusTimer } from './FocusTimer';

describe('FocusTimer', () => {
  afterEach(() => cleanup());
  const props = { taskTitle: 'Deep Work Session', secondsRemaining: 1500, totalDurationSeconds: 1800, isActive: true, onToggleActive: vi.fn(), currentStepIndex: 0, totalSteps: 2 };

  it('renders the timer and calm execution state', () => {
    render(<FocusTimer {...props} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('In flow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('handles pause and resume', () => {
    const onToggleActive = vi.fn();
    render(<FocusTimer {...props} onToggleActive={onToggleActive} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onToggleActive).toHaveBeenCalledTimes(1);
  });
});
