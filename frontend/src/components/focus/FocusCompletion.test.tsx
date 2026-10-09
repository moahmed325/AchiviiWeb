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
