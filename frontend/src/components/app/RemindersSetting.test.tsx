import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemindersSetting } from './AccountMenu';

// ND-28: the missed-day reminder email, on unless turned off, switched from the account menu.

const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'leo@example.com', created_at: '' } as { remindersEnabled?: boolean; remindersAvailable?: boolean } & Record<string, unknown>,
  setReminders: vi.fn(),
}));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

beforeEach(() => {
  auth.user.remindersEnabled = undefined;
  auth.user.remindersAvailable = true;
  auth.setReminders.mockReset().mockResolvedValue(undefined);
});

const box = () => screen.getByRole('checkbox', { name: 'Email me after a missed day' });

describe('the reminders setting', () => {
  it('is hidden while reminder emails are not being sent', () => {
    auth.user.remindersAvailable = false;
    const { container } = render(<RemindersSetting />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is on by default and turns off when unticked', async () => {
    const user = userEvent.setup();
    render(<RemindersSetting />);
    expect(box()).toBeChecked();
    await user.click(box());
    expect(auth.setReminders).toHaveBeenCalledWith(false);
  });

  it('shows off when the person turned it off, and turns back on', async () => {
    const user = userEvent.setup();
    auth.user.remindersEnabled = false;
    render(<RemindersSetting />);
    expect(box()).not.toBeChecked();
    await user.click(box());
    expect(auth.setReminders).toHaveBeenCalledWith(true);
  });

  it('says so when saving fails', async () => {
    const user = userEvent.setup();
    auth.setReminders.mockRejectedValue(new Error('nope'));
    render(<RemindersSetting />);
    await user.click(box());
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
  });
});
