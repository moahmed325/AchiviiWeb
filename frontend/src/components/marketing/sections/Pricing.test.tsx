import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pricing } from './Pricing';

describe('landing Pricing', () => {
  it('shows Free and Pro with their prices, each linking to signup, with no checkout on the page', () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>,
    );
    const section = screen.getByRole('region', { name: 'Free to start. Pro if you want your own goal.' });

    const free = within(section).getByRole('heading', { level: 3, name: 'Achivii Free' }).closest('li') as HTMLElement;
    expect(free).toHaveTextContent('$0');
    expect(within(free).getByRole('link', { name: 'Start free' })).toHaveAttribute('href', '/signup');

    const pro = within(section).getByRole('heading', { level: 3, name: 'Achivii Pro' }).closest('li') as HTMLElement;
    expect(pro).toHaveTextContent('$9a month, or $72 a year');
    expect(within(pro).getByRole('link', { name: 'Get Pro' })).toHaveAttribute('href', '/signup?premium=1');

    // Checkout stays inside the signed-in app, behind the server-side entitlement check.
    expect(within(section).queryByRole('button')).toBeNull();
  });
});
