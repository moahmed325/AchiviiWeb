import React from 'react';
import { useInView } from './hooks';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  id?: string;
  as?: 'div' | 'li' | 'p' | 'h2' | 'h3' | 'span' | 'ol' | 'ul' | 'figure';
}

export const Reveal: React.FC<RevealProps> = ({ children, className = '', delayMs = 0, id, as = 'div' }) => {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`}
      style={{ '--reveal-delay': `${delayMs}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
};
