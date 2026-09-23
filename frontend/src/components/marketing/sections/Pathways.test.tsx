import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pathways } from './Pathways';
import { CERTIFIED_PATHWAYS, PATHWAY_GROUPS } from '../../../lib/certifiedPresets';

describe('landing Pathways', () => {
  it('shows the same directions and pathways as the app, each linking to signup by its slug', () => {
    render(
      <MemoryRouter>
        <Pathways />
      </MemoryRouter>,
    );
    const section = screen.getByRole('region', { name: 'Ten journeys, ready to begin.' });
    const headings = within(section).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect([...headings].sort()).toEqual(PATHWAY_GROUPS.map((g) => g.direction).sort());

    const links = within(section).getAllByRole('link');
    expect(links).toHaveLength(CERTIFIED_PATHWAYS.length);
    for (const p of CERTIFIED_PATHWAYS) {
      const link = within(section).getByRole('link', { name: new RegExp(`^${p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });
      expect(link).toHaveAttribute('href', `/signup?pathway=${p.id}`);
      expect(link).toHaveTextContent(p.summary);
    }
  });

  it('lists each pathway under its own direction', () => {
    render(
      <MemoryRouter>
        <Pathways />
      </MemoryRouter>,
    );
    for (const group of PATHWAY_GROUPS) {
      const list = screen.getByRole('heading', { level: 3, name: group.direction }).nextElementSibling as HTMLElement;
      expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(
        group.pathways.map((p) => `/signup?pathway=${p.id}`),
      );
    }
  });
});
