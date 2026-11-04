import React, { useEffect, useState } from 'react';
import { Button } from './Button';
import { Wordmark } from './Wordmark';
import { useScrolledPast } from './hooks';

const LINKS = [
  { href: '#goals', label: 'Goals' },
  { href: '#how', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
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
        className={`mx-auto flex max-w-[1120px] items-center justify-between gap-2 rounded-panel border py-1.5 pl-4 pr-1.5 sm:pl-5 transition-colors duration-300 ${
          scrolled ? 'border-border-strong bg-background/90 backdrop-blur-md' : 'border-transparent bg-transparent'
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
                  className={`focus-ring inline-flex min-h-11 items-center rounded-full px-4 text-small transition-colors hover:text-text ${
                    isActive ? 'text-text' : 'text-text-secondary'
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1">
          {apiOffline && (
            <span
              role="status"
              className="mr-1 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 font-ui-mono text-micro uppercase text-text-secondary"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-achievement" />
              Offline
            </span>
          )}
          <Button variant="quiet" to="/login" className="px-3 sm:px-4">
            Sign in
          </Button>
          <Button variant="gold" href="#top" className="px-4 sm:px-5">
            Start
          </Button>
        </div>
      </nav>
    </header>
  );
};
