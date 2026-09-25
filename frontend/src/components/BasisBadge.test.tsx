import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BasisBadge } from './BasisBadge';

describe('BasisBadge (restyled with Phase 0 tokens)', () => {
  it('renders nothing when basis is null or undefined or has no label', () => {
    const { container, rerender } = render(<BasisBadge basis={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<BasisBadge basis={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<BasisBadge basis={{ label: '' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders label with Sparkles icon and Phase 0 tokens', () => {
    render(<BasisBadge basis={{ label: 'Ultralearning', anchored: true }} />);
    const badge = screen.getByText('Ultralearning');
    expect(badge).toBeVisible();
    expect(badge.closest('span')).toHaveClass('bg-surface');
    expect(badge.closest('span')).toHaveClass('border-border');
    expect(badge.closest('span')).toHaveClass('text-accent');
    expect(badge.closest('span')).toHaveClass('font-ui-mono');
  });
});
