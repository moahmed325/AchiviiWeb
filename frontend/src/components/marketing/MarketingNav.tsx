import React from 'react';
import { Button } from './Button';
import { Wordmark } from './Wordmark';
import { useScrolledPast } from './hooks';

const LINKS = [
  { href: '#method', label: 'How it works' },
  { href: '#pathways', label: 'Journeys' },
  { href: '#premium', label: 'Coach' },
];

export const MarketingNav: React.FC<{ apiOffline: boolean }> = ({ apiOffline }) => {
  const scrolled = useScrolledPast(24);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <nav
        aria-label="Primary"
        className={`mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-full border py-1.5 pl-5 pr-1.5 transition-[background-color,border-color,backdrop-filter] duration-500 ${
          scrolled ? 'border-border bg-background/75 backdrop-blur-xl' : 'border-transparent bg-transparent'
        }`}
      >
        <a href="#top" className="flex min-h-11 items-center rounded-full" aria-label="Achivii, back to top">
          <Wordmark />
        </a>

        <ul className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] text-text-secondary transition-colors hover:text-text"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          {apiOffline && (
            <span
              role="status"
              className="mr-1 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.14em] text-text-secondary"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-achievement" />
              Offline
            </span>
          )}
          <Button variant="quiet" to="/login" className="px-3 sm:px-4">
            Sign in
          </Button>
          <Button variant="primary" to="/signup" className="px-4 sm:px-5">
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start your journey</span>
          </Button>
        </div>
      </nav>
    </header>
  );
};
