import React from 'react';
import { Badge } from '../ui';

/** From the load-time health check only (R-17). A failed write while offline is M5.7. */
export const OfflineChip: React.FC<{ className?: string }> = ({ className }) => (
  <Badge
    tone="caution"
    role="status"
    className={className}
    icon={<span aria-hidden="true" className="size-1.5 rounded-full bg-caution" />}
  >
    Offline
  </Badge>
);
