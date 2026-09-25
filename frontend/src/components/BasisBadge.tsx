import React from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from './ui/Badge';
import { cx } from './ui/cx';

export interface BasisBadgeProps {
  basis?: { label: string; anchored?: boolean } | null;
  className?: string;
}

/** Honest basis line. Restyled with Phase 0 tokens for Today and Roadmap. */
export const BasisBadge: React.FC<BasisBadgeProps> = ({ basis, className }) => {
  if (!basis?.label) return null;

  return (
    <Badge
      tone="accent"
      icon={<Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3 text-accent shrink-0" />}
      className={cx('bg-surface border-border text-accent font-ui-mono text-micro normal-case', className)}
    >
      {basis.label}
    </Badge>
  );
};

export default BasisBadge;
