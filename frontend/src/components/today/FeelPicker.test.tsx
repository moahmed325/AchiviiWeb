import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DailyTask } from '../../types';
import { FeelPicker } from './FeelPicker';

// No weekly tests, section 7: the feel tap after a done session saves one tap at a time.

const save = vi.hoisted(() => ({ resolve: [] as Array<() => void>, calls: [] as unknown[] }));
vi.mock('./useTaskActions', () => ({
  useTaskActions: () => ({
    saveFeel: (_task: DailyTask, feel: unknown) => {
      save.calls.push(feel);
      return new Promise((resolve) => save.resolve.push(() => resolve({ ok: true })));
    },
  }),
}));

describe('FeelPicker', () => {
  it('a second tap waits until the first is saved', async () => {
    const user = userEvent.setup();
    render(<FeelPicker task={{ id: 't1', status: 'completed', feel: null } as unknown as DailyTask} onAddNote={() => {}} />);
    const group = screen.getByRole('group', { name: 'How did it feel?' });
    await user.click(within(group).getByRole('radio', { name: 'Too easy' }));
    expect(within(group).getByRole('radio', { name: 'Too hard' })).toBeDisabled();
    await user.click(within(group).getByRole('radio', { name: 'Too hard' }));
    expect(save.calls).toEqual(['too_easy']);
  });
});
