import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pathways } from './Pathways';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS } from '../../../lib/certifiedPresets';

const renderPathways = () =>
  render(
    <MemoryRouter>
      <Pathways />
    </MemoryRouter>,
  );

const hrefs = (root: HTMLElement) => within(root).getAllByRole('link').map((a) => a.getAttribute('href'));

describe('landing Pathways', () => {
  it('shows four featured pathways as photo cards, each linking to signup by its slug', () => {
    renderPathways();
    const popular = screen.getByRole('list', { name: 'Popular goals' });
    expect(hrefs(popular)).toEqual(FEATURED_PATHWAYS.map((p) => `/signup?pathway=${p.id}`));
    expect(new Set(FEATURED_PATHWAYS.map((p) => p.direction)).size).toBe(FEATURED_PATHWAYS.length);
    for (const p of FEATURED_PATHWAYS) {
      const card = within(popular).getByText(p.title).closest('a') as HTMLElement;
      expect(card).toHaveTextContent(`${p.dailyMinutes} min a day`);
      expect(card.querySelector('img')).toHaveAttribute('src', p.image);
    }
  });

  it('shows every other pathway as a chip, so all of them are visible without opening anything', () => {
    renderPathways();
    const more = screen.getByRole('list', { name: 'More free goals' });
    const rest = CERTIFIED_PATHWAYS.filter((p) => !FEATURED_PATHWAYS.includes(p));
    expect(hrefs(more)).toEqual(rest.map((p) => `/signup?pathway=${p.id}`));
    expect(FEATURED_PATHWAYS.length + rest.length).toBe(CERTIFIED_PATHWAYS.length);
  });

  it('makes the case for a goal of your own, leading to Pro', () => {
    renderPathways();
    expect(screen.getByRole('heading', { level: 3, name: 'Or bring your own goal.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Build my own plan' })).toHaveAttribute('href', '/signup?premium=1');
    expect(screen.getByText('$9 a month or $72 a year')).toBeInTheDocument();
  });
});
