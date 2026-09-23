import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PathwayLibrary } from './PathwayLibrary';
import { PathwayCustomGoal } from './PathwayCustomGoal';
import { CERTIFIED_PATHWAYS, PATHWAY_GROUPS, findPathwayBySlug } from '../../lib/certifiedPresets';

const directionGroup = () => screen.getByRole('group', { name: 'Choose a direction' });

describe('PathwayLibrary (cards)', () => {
  it('offers the six directions with their pathway counts, and no pathway until one is chosen', () => {
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose: vi.fn() }} />);
    const directions = within(directionGroup()).getAllByRole('radio');
    expect(directions.map((r) => r.getAttribute('value'))).toEqual(['Career', 'Fitness', 'Learning', 'Creative', 'Business', 'Personal']);
    expect(within(directionGroup()).getByRole('radio', { name: 'Creative' })).toHaveAccessibleDescription('3 pathways');
    expect(within(directionGroup()).getByRole('radio', { name: 'Career' })).toHaveAccessibleDescription('1 pathway');
    expect(screen.getAllByRole('radio')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /Start this pathway/ })).not.toBeInTheDocument();
  });

  it('shows a direction’s pathways and emits the chosen pathway’s identity', async () => {
    const onChoose = vi.fn();
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose }} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Fitness' }));

    const pathways = screen.getByRole('group', { name: 'Choose a fitness pathway' });
    expect(within(pathways).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['run10k', 'recomp']);
    const start = screen.getByRole('button', { name: /Start this pathway/ });
    expect(start).toBeDisabled();

    const run = screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' });
    await userEvent.click(run);
    expect(run).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Drop 5% Body Fat & Build Lean Muscle' })).not.toBeChecked();
    expect(start).toBeEnabled();

    await userEvent.click(start);
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith(findPathwayBySlug('run10k'));
  });

  it('selects the only pathway of a one-pathway direction straight away', async () => {
    const onChoose = vi.fn();
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose }} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Career' }));

    expect(screen.getByRole('group', { name: 'The career pathway' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Deliver a 15-Minute TED-Style Speech' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /Start this pathway/ }));
    expect(onChoose).toHaveBeenCalledWith(findPathwayBySlug('speech'));
  });

  it('never starts a pathway from a direction that is no longer shown', async () => {
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose: vi.fn() }} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Fitness' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Creative' }));
    expect(screen.getByRole('button', { name: /Start this pathway/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Fitness' }));
    expect(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' })).not.toBeChecked();
  });

  it('makes every pathway in the catalogue reachable', async () => {
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose: vi.fn() }} />);
    const seen = new Set<string>();
    for (const group of PATHWAY_GROUPS) {
      await userEvent.click(within(directionGroup()).getByRole('radio', { name: group.direction }));
      for (const p of group.pathways) {
        const card = screen.getByRole('radio', { name: p.title }).closest('label');
        expect(card).toHaveTextContent(p.summary);
        expect(card).toHaveTextContent(`Built on ${p.badge}`);
        expect(card).toHaveTextContent(`${p.dailyMinutes} min a day · 90 days`);
        seen.add(p.id);
      }
    }
    expect(seen.size).toBe(CERTIFIED_PATHWAYS.length);
  });

  it('opens on a pathway chosen earlier, with its direction shown', () => {
    render(<PathwayLibrary defaultSelectedId="chess" action={{ label: 'Start this pathway', onChoose: vi.fn() }} />);
    expect(screen.getByRole('radio', { name: 'Learning' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Climb to a 1200 Rapid Chess Rating' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Start this pathway/ })).toBeEnabled();
  });

  it('works from the keyboard alone', async () => {
    const onChoose = vi.fn();
    render(<PathwayLibrary action={{ label: 'Start this pathway', onChoose }} />);
    screen.getByRole('radio', { name: 'Career' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Fitness' })).toBeChecked();
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: /Start this pathway/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onChoose).toHaveBeenCalledWith(findPathwayBySlug('run10k'));
  });

  it('shows a custom goal after the pathways, free and available (ND-6)', () => {
    render(
      <PathwayLibrary
        action={{ label: 'Start this pathway', onChoose: vi.fn() }}
        customGoal={
          <PathwayCustomGoal>
            <button type="button">Describe my own goal</button>
          </PathwayCustomGoal>
        }
      />,
    );
    const custom = screen.getByRole('region', { name: 'Something else in mind?' });
    expect(within(custom).getByRole('button', { name: 'Describe my own goal' })).toBeEnabled();
    expect(custom).not.toHaveTextContent(/premium|pro\b|locked|upgrade|paid|price|\$/i);
    expect(directionGroup().compareDocumentPosition(custom) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('PathwayLibrary (tabs)', () => {
  it('opens on the first direction, with one tab per direction and its pathways as radios', () => {
    render(<PathwayLibrary navigation="tabs" />);
    const tabs = within(screen.getByRole('tablist', { name: 'Directions' })).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(PATHWAY_GROUPS.map((g) => g.direction));
    expect(screen.getByRole('tab', { name: 'Career' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'Deliver a 15-Minute TED-Style Speech' })).toBeChecked();
  });

  it('marks the current pathway in words, not colour alone, and opens on its direction', () => {
    render(<PathwayLibrary navigation="tabs" currentId="recomp" />);
    expect(screen.getByRole('tab', { name: 'Fitness' })).toHaveAttribute('aria-selected', 'true');
    const current = screen.getByRole('radio', { name: 'Drop 5% Body Fat & Build Lean Muscle' });
    expect(current).toHaveAccessibleDescription(/^Current pathway/);
    expect(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' })).not.toHaveAccessibleDescription(/Current pathway/);
  });

  it('switches direction from its tab and auto-selects a lone pathway', async () => {
    render(<PathwayLibrary navigation="tabs" defaultSelectedId="run10k" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Personal' }));
    expect(screen.getByRole('radio', { name: 'Master Deep Work & Double Daily Output' })).toBeChecked();
  });
});
