import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pricing } from './Pricing';

describe('landing Pricing', () => {
  it('shows the 30 free days and Pro with their prices, with no checkout on the page (ND-37)', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    const section = screen.getByRole('region', { name: 'Thirty days free. Then Pro keeps it going.' });

    const free = within(section).getByRole('heading', { level: 3, name: 'Your first 30 days' }).closest('li') as HTMLElement;
    expect(free).toHaveTextContent('$0no card needed');
    expect(within(free).getByRole('link', { name: 'Start my 30 days' })).toHaveAttribute('href', '#top');

    const pro = within(section).getByRole('heading', { level: 3, name: 'Achivii Pro' }).closest('li') as HTMLElement;
    expect(pro).toHaveTextContent('$9a month, or $72 a year');
    expect(within(pro).getByRole('link', { name: 'Get Pro' })).toHaveAttribute('href', '/signup?premium=1');

    // Checkout stays inside the signed-in app, behind the server-side entitlement check.
    expect(within(section).queryByRole('button')).toBeNull();
  });
});
