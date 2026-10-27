import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Pathways } from './Pathways';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS, PATHWAY_ARCS } from '../../../lib/certifiedPresets';

const renderPathways = () =>
  render(
    <MemoryRouter>
      <Pathways />
    </MemoryRouter>,
  );

const railHrefs = () =>
  within(screen.getByRole('list', { name: 'Free goals' }))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));

describe('landing Pathways', () => {
  it('has a Day 1, Day 90 goal and week-1 session for every pathway', () => {
    for (const p of CERTIFIED_PATHWAYS) {
      const arc = PATHWAY_ARCS[p.id];
      expect(arc, p.id).toBeDefined();
      expect(arc.dayOne && arc.dayNinety && arc.weekOneSession, p.id).toBeTruthy();
    }
  });

  it('shows every pathway in the rail, featured first, each linking to signup with its photo, time and arc', () => {
    renderPathways();
    const rest = CERTIFIED_PATHWAYS.filter((p) => !FEATURED_PATHWAYS.includes(p));
    expect(railHrefs()).toEqual([...FEATURED_PATHWAYS, ...rest].map((p) => `/signup?pathway=${p.id}`));

    const rail = screen.getByRole('list', { name: 'Free goals' });
    for (const p of CERTIFIED_PATHWAYS) {
      const card = within(rail).getByText(p.title).closest('a') as HTMLElement;
      expect(card.querySelector('img')).toHaveAttribute('src', p.image);
      expect(card).toHaveTextContent(`${p.dailyMinutes} min a day`);
      expect(card).toHaveTextContent(PATHWAY_ARCS[p.id].dayOne);
      expect(card).toHaveTextContent(`Day 90 goal${PATHWAY_ARCS[p.id].dayNinety}`);
    }
  });

  it('filters the rail by daily time and can show every goal again', async () => {
    const user = userEvent.setup();
    renderPathways();
    const filters = screen.getByRole('group', { name: 'Daily time' });
    expect(within(filters).getByRole('button', { name: 'Any time' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(filters).getByRole('button', { name: '30 min or less' }));
    expect(within(filters).getByRole('button', { name: '30 min or less' })).toHaveAttribute('aria-pressed', 'true');
    const short = CERTIFIED_PATHWAYS.filter((p) => p.dailyMinutes <= 30).map((p) => `/signup?pathway=${p.id}`);
    expect([...railHrefs()].sort()).toEqual([...short].sort());
    expect(screen.getByRole('status')).toHaveTextContent(`${short.length} goals shown`);

    await user.click(within(filters).getByRole('button', { name: 'Any time' }));
    expect(railHrefs()).toHaveLength(CERTIFIED_PATHWAYS.length);
  });

  it('makes the case for a goal of your own, leading to Pro', () => {
    renderPathways();
    expect(screen.getByRole('heading', { level: 3, name: 'Or bring your own goal.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Build my own plan' })).toHaveAttribute('href', '/signup?premium=1');
    expect(screen.getByText('$9 a month or $72 a year')).toBeInTheDocument();
  });
});
