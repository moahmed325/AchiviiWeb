import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Wordmark } from './Wordmark';
import { useScrolledPast } from './hooks';

const LINKS = [
  { href: '#method', label: 'How it works' },
  { href: '#pathways', label: 'Journeys' },
  { href: '#premium', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

/** Which section the reader is in, so the nav can show where they are on the page. */
const useActiveSection = (ids: string[]): string | null => {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  return active;
};

const SECTION_IDS = LINKS.map((link) => link.href.slice(1));

export const MarketingNav: React.FC<{ apiOffline: boolean }> = ({ apiOffline }) => {
  const scrolled = useScrolledPast(24);
  const active = useActiveSection(SECTION_IDS);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <nav
        aria-label="Primary"
        className={`mx-auto flex max-w-[1080px] items-center justify-between gap-4 rounded-full border py-1.5 pl-5 pr-1.5 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-500 ${
          scrolled
            ? 'border-achievement/25 bg-background/80 shadow-[0_18px_50px_-30px_rgba(200,169,107,0.5)] backdrop-blur-xl'
            : 'border-border/60 bg-background/35 backdrop-blur-md'
        }`}
      >
        <a href="#top" className="focus-ring flex min-h-11 items-center rounded-full" aria-label="Achivii, back to top">
          <Wordmark />
        </a>

        <ul className="hidden md:flex items-center gap-1">
          {LINKS.map((link) => {
            const isActive = active === link.href.slice(1);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={isActive ? 'location' : undefined}
                  className={`focus-ring relative inline-flex min-h-11 items-center rounded-full px-4 text-[14px] transition-colors hover:text-achievement-hover ${
                    isActive ? 'text-achievement-hover' : 'text-text-secondary'
                  }`}
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-4 bottom-1.5 h-px origin-center bg-gradient-to-r from-transparent via-achievement to-transparent transition-transform duration-500 ease-ascend ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </a>
              </li>
            );
          })}
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
          <Button variant="gold" to="/signup" className="px-4 sm:px-5">
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start your journey</span>
          </Button>
        </div>
      </nav>
    </header>
  );
};
