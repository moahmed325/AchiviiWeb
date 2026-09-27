import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoachModal } from './CoachModal';

describe('CoachModal', () => {
  const setup = (isOpen = true) => {
    const onClose = vi.fn();
    render(<CoachModal isOpen={isOpen} onClose={onClose} />);
    return { onClose };
  };

  it('renders the headline "Achivii Coach"', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Achivii Coach' })).toBeInTheDocument();
  });

  it('renders the honest "In development" status', () => {
    setup();
    expect(screen.getByText('In development')).toBeInTheDocument();
  });

  it('renders the "Coming Soon" premium eyebrow', () => {
    setup();
    expect(screen.getByText(/Coming Soon/i)).toBeInTheDocument();
  });

  it('contains accurate descriptive copy about the companion coaching vision', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/1-on-1 companion/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/90-day pathway/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/proven mastery methods/i)).toBeInTheDocument();
  });

  it('contains the realistic availability note', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/actively being designed/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/first to access/i)).toBeInTheDocument();
  });

  it('contains NO fake input fields or checkout triggers', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByText(/upgrade/i)).toBeNull();
    expect(within(dialog).queryByText(/buy/i)).toBeNull();
    expect(within(dialog).queryByText(/\$\d/)).toBeNull();
    expect(within(dialog).queryByText(/checkout/i)).toBeNull();
    expect(within(dialog).queryByPlaceholderText(/message/i)).toBeNull();
  });

  it('"Back to Practice" button triggers onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Back to Practice' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has an accessible close button with correct aria-label', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Close Coach details' })).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
