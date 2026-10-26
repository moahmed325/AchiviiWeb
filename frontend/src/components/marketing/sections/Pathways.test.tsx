import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Pathways } from './Pathways';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';

const renderPathways = () =>
  render(
    <MemoryRouter>
      <Pathways />
    </MemoryRouter>,
  );

describe('landing Pathways', () => {
  it('shows every pathway in catalogue order, each linking to signup by its slug with its daily time', () => {
    renderPathways();
    const section = screen.getByRole('region', { name: 'What do you want to get good at?' });

    const links = within(section)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/signup?pathway='));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(CERTIFIED_PATHWAYS.map((p) => `/signup?pathway=${p.id}`));

    for (const p of CERTIFIED_PATHWAYS) {
      const title = p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const link = within(section).getByRole('link', { name: new RegExp(`^${title}\\s*${p.dailyMinutes} min a day$`) });
      expect(link.querySelector('img')).toHaveAttribute('src', p.image);
    }
  });

  it('offers a goal of your own through Pro', () => {
    renderPathways();
    expect(screen.getByRole('link', { name: 'Pro builds a plan around your own' })).toHaveAttribute('href', '/signup?premium=1');
  });
});
