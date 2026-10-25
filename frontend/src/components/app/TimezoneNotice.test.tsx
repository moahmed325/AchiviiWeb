import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimezoneNotice } from './AccountMenu';

// B-46 (2), Travelling Leo: the account menu offers to move the plan to this device's time zone.

const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'leo@example.com', created_at: '', timezone: 'Europe/London' } as { timezone?: string } & Record<string, unknown>, setTimezone: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));

const realResolved = Intl.DateTimeFormat.prototype.resolvedOptions;
const deviceZone = (zone: string) =>
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...realResolved.call(this), timeZone: zone };
  });

beforeEach(() => {
  auth.user.timezone = 'Europe/London';
  auth.setTimezone.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('the time zone notice', () => {
  it('offers the device zone when it differs from the plan', async () => {
    const user = userEvent.setup();
    deviceZone('Asia/Tokyo');
    render(<TimezoneNotice />);
    expect(screen.getByText('Your plan uses London time. This device is in Tokyo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Use Tokyo time' }));
    expect(auth.setTimezone).toHaveBeenCalledWith('Asia/Tokyo');
  });

  it('shows nothing when the device is in the plan zone', () => {
    deviceZone('Europe/London');
    const { container } = render(<TimezoneNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('says so when saving fails', async () => {
    const user = userEvent.setup();
    deviceZone('America/New_York');
    auth.setTimezone.mockRejectedValue(new Error('nope'));
    render(<TimezoneNotice />);
    await user.click(screen.getByRole('button', { name: 'Use New York time' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't save. Please try again.");
  });
});
