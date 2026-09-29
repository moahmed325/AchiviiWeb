import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Premium } from './Premium';

describe('marketing Premium section (M10.6)', () => {
  it('renders accessible section with h2 title and h3 feature headings', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });
    expect(section).toBeInTheDocument();

    const h2 = within(section).getByRole('heading', { level: 2, name: 'More ways to climb, on the way.' });
    expect(h2).toBeInTheDocument();

    const h3s = within(section).getAllByRole('heading', { level: 3 });
    expect(h3s.map((h) => h.textContent)).toEqual([
      'Talk to your coach.',
      'Have something unique in mind?',
    ]);
  });

  it('renders Achivii Coach with honest "In development" status and accurate copy', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });

    expect(within(section).getByText('Achivii Coach')).toBeInTheDocument();
    expect(within(section).getByText('In development')).toBeInTheDocument();
    expect(
      within(section).getByText(/Talk through a hard week, ask why a step matters/i),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/It is being designed now and isn’t available yet/i),
    ).toBeInTheDocument();
  });

  it('renders Achivii Pro with "Available now" status and accurate narrative copy', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });

    expect(within(section).getByText('Achivii Pro')).toBeInTheDocument();
    expect(within(section).getByText('Available now')).toBeInTheDocument();
    expect(
      within(section).getByText(
        /Build a guided 90-day journey around your own ambition, beyond the certified pathways/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        /Pro is \$9\/month or \$72\/year, and every existing journey stays available/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders the Pro pricing line without any inline checkout UI', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });

    expect(
      within(section).getByText(
        /Achivii Pro is \$9\/month or \$72\/year\. Certified pathways stay free/i,
      ),
    ).toBeInTheDocument();

    // The marketing page informs about pricing; the checkout itself stays inside
    // the authenticated app behind the server-side entitlement gate.
    expect(within(section).queryByRole('button')).toBeNull();
  });
});
