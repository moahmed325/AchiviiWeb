import React from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../Wordmark';

const LINKS = [
  { href: '#method', label: 'How it works' },
  { href: '#journey', label: 'The journey' },
  { href: '#pathways', label: 'Journeys' },
  { href: '#premium', label: 'Coach' },
];

const LEGAL_LINKS = [
  { href: '/legal/terms', label: 'Terms of Service' },
  { href: '/legal/privacy', label: 'Privacy Policy' },
  { href: '/legal/refunds', label: 'Refund & Cancellation' },
  { href: '/legal/contact', label: 'Contact & Support' },
];

export const MarketingFooter: React.FC = () => (
  <footer className="border-t border-border px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14 sm:px-10 lg:px-16">
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 md:flex-row md:items-start md:justify-between">
      <div>
        <Wordmark />
        <p className="mt-4 max-w-[22rem] text-sm leading-relaxed text-text-secondary">
          One meaningful goal. Ninety days. One focused step at a time.
        </p>
      </div>
      <nav aria-label="Footer">
        <ul className="grid grid-cols-2 gap-x-10 gap-y-1 sm:flex sm:gap-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="inline-flex min-h-11 items-center text-sm text-text-secondary transition-colors hover:text-text sm:px-3">
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <Link
              to="/login"
              className="inline-flex min-h-11 cursor-pointer items-center text-sm text-text-secondary transition-colors hover:text-text sm:px-3"
            >
              Sign in
            </Link>
          </li>
          <li>
            <Link
              to="/signup?premium=1"
              className="inline-flex min-h-11 cursor-pointer items-center text-sm text-text-secondary transition-colors hover:text-text sm:px-3"
            >
              Pro — $9/month or $72/year
            </Link>
          </li>
        </ul>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-4">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="inline-flex min-h-9 items-center text-xs text-text-secondary/90 transition-colors hover:text-text"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
    <p className="mx-auto mt-12 w-full max-w-[1280px] font-ui-mono text-xs text-text-secondary/80">
      Achivii © {new Date().getFullYear()}
    </p>
  </footer>
);
