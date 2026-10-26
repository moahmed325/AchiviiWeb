import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pathways } from './Pathways';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS, PATHWAY_GROUPS } from '../../../lib/certifiedPresets';

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

  it('keeps every pathway, grouped by direction, behind "See all"', () => {
    renderPathways();
    const all = screen.getByText(`See all ${CERTIFIED_PATHWAYS.length} goals`).closest('details') as HTMLElement;
    expect(all).not.toHaveAttribute('open');
    for (const group of PATHWAY_GROUPS) {
      const list = within(all).getByRole('heading', { level: 3, name: group.direction }).nextElementSibling as HTMLElement;
      expect(hrefs(list)).toEqual(group.pathways.map((p) => `/signup?pathway=${p.id}`));
    }
    expect(within(all).getAllByRole('link')).toHaveLength(CERTIFIED_PATHWAYS.length);
  });

  it('offers a goal of your own through Pro', () => {
    renderPathways();
    expect(screen.getByRole('link', { name: 'Pro builds a plan around your own' })).toHaveAttribute('href', '/signup?premium=1');
  });
});
