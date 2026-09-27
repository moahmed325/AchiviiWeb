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

  it('renders Custom Journeys with "Available now · Free" status and accurate narrative copy', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });

    expect(within(section).getByText('Custom Journeys')).toBeInTheDocument();
    expect(within(section).getByText('Available now · Free')).toBeInTheDocument();
    expect(
      within(section).getByText(
        /Build a guided 90-day journey around your own ambition, beyond the certified pathways/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/Available free today, planned for a future premium tier/i),
    ).toBeInTheDocument();
  });

  it('renders the free reassurance line without any paid plans or checkout UI', () => {
    render(<Premium />);
    const section = screen.getByRole('region', { name: 'More ways to climb, on the way.' });

    expect(
      within(section).getByText(
        'There is no paid plan yet. Everything you can use in Achivii today is free.',
      ),
    ).toBeInTheDocument();

    // Verify zero checkout, billing, or pricing elements
    expect(within(section).queryByRole('button')).toBeNull();
    expect(within(section).queryByText(/subscribe|checkout|pricing|\$\d/i)).toBeNull();
  });
});
