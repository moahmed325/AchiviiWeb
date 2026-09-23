import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PathwayStrip } from './PathwayStrip';
import { PATHWAY_GROUPS, findPathwayBySlug } from '../../lib/certifiedPresets';

describe('PathwayStrip', () => {
  it('lists every pathway as one button each, grouped by direction', () => {
    render(<PathwayStrip onOpen={vi.fn()} onExploreAll={vi.fn()} />);
    const strip = screen.getByRole('region', { name: 'Pathways' });
    const tiles = within(within(strip).getByRole('list')).getAllByRole('button');
    expect(tiles.map((t) => t.textContent)).toEqual(
      PATHWAY_GROUPS.flatMap((g) => g.pathways).map((p) => expect.stringContaining(p.title)),
    );
    for (const tile of tiles) {
      expect(tile).toHaveAttribute('aria-haspopup', 'dialog');
      expect(tile.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    }
  });

  it('marks the current pathway in words as well as with its border', () => {
    render(<PathwayStrip currentId="spanish" onOpen={vi.fn()} onExploreAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Speak Conversational Spanish' })).toHaveAccessibleDescription(/^Current /);
    expect(screen.getByRole('button', { name: 'Climb to a 1200 Rapid Chess Rating' })).not.toHaveAccessibleDescription(/Current/);
  });

  it('reports the chosen pathway, and "Explore all", without navigating itself', async () => {
    const onOpen = vi.fn();
    const onExploreAll = vi.fn();
    render(<PathwayStrip onOpen={onOpen} onExploreAll={onExploreAll} />);
    await userEvent.click(screen.getByRole('button', { name: 'Write & Polish a 30,000-Word Book' }));
    expect(onOpen).toHaveBeenCalledWith(findPathwayBySlug('book'));
    await userEvent.click(screen.getByRole('button', { name: 'Explore all' }));
    expect(onExploreAll).toHaveBeenCalledTimes(1);
  });

  it('starts with the back control disabled', () => {
    render(<PathwayStrip onOpen={vi.fn()} onExploreAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Scroll pathways back' })).toBeDisabled();
  });
});
