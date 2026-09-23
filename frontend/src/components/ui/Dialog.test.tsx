import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Dialog, DialogContent, DialogTrigger, SheetContent } from './Dialog';

describe('Dialog', () => {
  it('opens with its title as the accessible name and moves focus inside', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Reset goal</Button>
        </DialogTrigger>
        <DialogContent title="Reset this goal?" description="Your progress will be archived.">
          <p>Body</p>
        </DialogContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset goal' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset this goal?' });
    expect(dialog).toHaveAccessibleDescription('Your progress will be archived.');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent title="Details">
          <p>Body</p>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('closes from the close button', async () => {
    render(
      <Dialog defaultOpen>
        <SheetContent title="Filters">
          <p>Body</p>
        </SheetContent>
      </Dialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
