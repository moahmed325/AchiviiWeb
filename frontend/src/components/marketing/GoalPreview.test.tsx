import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GoalPreview } from './GoalPreview';
import { PATHWAY_ARCS } from '../../lib/certifiedPresets';

describe('GoalPreview', () => {
  it('describes the example goal, its Day 1 and Day 90, and today’s step in one image label', () => {
    render(<GoalPreview />);
    const arc = PATHWAY_ARCS.run10k;
    const image = screen.getByRole('img', { name: /Goal: Run a 10K/ });
    const label = image.getAttribute('aria-label') ?? '';
    for (const part of [arc.dayOne, arc.dayNinety, arc.weekOneSession]) expect(label).toContain(part);
    expect(screen.getByText('Example from the 10K plan')).toBeInTheDocument();
  });
});
