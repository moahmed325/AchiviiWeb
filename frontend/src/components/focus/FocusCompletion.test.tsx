import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FocusCompletion } from './FocusCompletion';

const renderCompletion = (reflectionNote: string) =>
  render(
    <FocusCompletion
      dayNumber={3}
      durationMinutes={30}
      reflectionNote={reflectionNote}
      onReflectionChange={vi.fn()}
      onSave={vi.fn()}
      isSubmitting={false}
      saveError={null}
    />,
  );

describe('FocusCompletion reflection box (B-29)', () => {
  it('limits the reflection to 2,000 characters', () => {
    renderCompletion('');
    expect(screen.getByLabelText(/One thing to remember/)).toHaveAttribute('maxLength', '2000');
    expect(screen.queryByText(/of 2,000 characters/)).not.toBeInTheDocument();
  });

  it('shows the count near the limit', () => {
    renderCompletion('x'.repeat(1700));
    expect(screen.getByLabelText(/One thing to remember/)).toHaveAccessibleDescription('1,700 of 2,000 characters');
  });
});

describe('FocusCompletion progress (ND-28)', () => {
  const days = (states: Array<'completed' | 'rest' | 'today' | 'upcoming' | 'new'>) => states.map((state, i) => ({ label: 'D' + i, state }));
  const renderWith = (progress: Parameters<typeof FocusCompletion>[0]['progress']) =>
    render(<FocusCompletion dayNumber={3} durationMinutes={30} reflectionNote="" onReflectionChange={vi.fn()} onSave={vi.fn()} isSubmitting={false} saveError={null} progress={progress} />);

  it("names the session's number and the week so far", () => {
    renderWith({ sessionNumber: 25, weekDone: 5, weekDays: 6, days: days(['completed', 'completed', 'new', 'upcoming', 'rest']) });
    expect(screen.getByText('Session complete · Session 25')).toBeInTheDocument();
    expect(screen.getByText('5 of 6 this week.')).toBeInTheDocument();
  });

  it('says so when the week is complete', () => {
    renderWith({ sessionNumber: 6, weekDone: 6, weekDays: 6, days: days(['completed', 'new']) });
    expect(screen.getByText('Week complete. Every session done.')).toBeInTheDocument();
  });

  it('without progress, the quiet line as before', () => {
    renderWith(undefined);
    expect(screen.getByText('Take a breath. Leave a note only if it helps.')).toBeInTheDocument();
  });
});
