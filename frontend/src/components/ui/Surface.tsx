import React from 'react';
import { cx } from './cx';

export type SurfaceTone = 'base' | 'elevated' | 'inset' | 'glass' | 'inverse';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';
export type SurfaceRadius = 'block' | 'card' | 'panel';

const tones: Record<SurfaceTone, string> = {
  base: 'bg-surface border border-border',
  elevated: 'bg-surface-elevated border border-border shadow-raised',
  inset: 'bg-background border border-border',
  /* Only over imagery or an atmospheric background (VDS §11). Inside the app, use base or elevated. */
  glass: 'bg-surface/70 border border-border-strong backdrop-blur-md shadow-raised',
  inverse: 'on-inverse bg-surface-inverse text-text-on-inverse',
};

const paddings: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const radii: Record<SurfaceRadius, string> = {
  block: 'rounded-block',
  card: 'rounded-card',
  panel: 'rounded-panel',
};

type SurfaceElement = 'div' | 'section' | 'article' | 'aside' | 'li';

export type SurfaceProps = React.HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  tone?: SurfaceTone;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
};

/** The one card and panel container. Architectural: solid, thin border, moderate radius. */
export const Surface: React.FC<SurfaceProps> = ({ as: Comp = 'div', tone = 'base', padding = 'md', radius = 'card', className, ...rest }) => (
  <Comp className={cx(tones[tone], paddings[padding], radii[radius], className)} {...rest} />
);
