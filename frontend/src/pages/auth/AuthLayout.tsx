import React, { useEffect, useRef } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import { SkipLink, Surface } from '../../components/ui';
import { Wordmark } from '../../components/marketing/Wordmark';
import type { CertifiedPathway } from '../../lib/certifiedPresets';

const IMAGE = '/images/brand/staircase.jpg';

const HomeLink: React.FC = () => (
  <Link to="/" aria-label="Achivii, home" className="focus-ring inline-flex min-h-11 items-center rounded-full">
    <Wordmark />
  </Link>
);

const PathwaySummary: React.FC<{ pathway: CertifiedPathway; size: 'panel' | 'card' }> = ({ pathway, size }) => (
  <>
    <p className="font-ui-mono text-micro uppercase text-accent-hover">Your chosen journey</p>
    <p className={size === 'panel' ? 'mt-4 max-w-[18ch] text-h2 text-text' : 'mt-2 text-body-lg font-medium leading-snug text-text'}>
      {pathway.title}
    </p>
    <p className="tabular mt-3 font-ui-mono text-micro uppercase text-text-secondary">
      {pathway.dailyMinutes} min a day <span aria-hidden="true" className="mx-1.5 text-text-muted">/</span> 90 days
    </p>
  </>
);

export interface AuthLayoutProps {
  /** Page heading, also used for the document title. */
  title: string;
  description: React.ReactNode;
  pathway?: CertifiedPathway;
  children: React.ReactNode;
}

/**
 * The threshold between the landing page and onboarding: imagery on one side, one focused form on the other. On
 * mobile the image shrinks to a faint band so the form sits high enough to use with the keyboard open.
 */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, description, pathway, children }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Achivii`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const navigationType = useNavigationType();
  useEffect(() => {
    window.scrollTo(0, 0);
    // After an in-app link, start screen readers and keyboard users at the heading. On a fresh load or back/forward,
    // leave focus where the browser puts it so the skip link comes first.
    if (navigationType !== 'POP') headingRef.current?.focus({ preventScroll: true });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ui-root min-h-[100dvh] bg-background text-text lg:grid lg:grid-cols-2">
      <SkipLink />

      <aside aria-label="Achivii" className="relative isolate hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <img src={IMAGE} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/55 to-background/25" />
        <HomeLink />
        <div className="max-w-md">
          {pathway ? (
            <PathwaySummary pathway={pathway} size="panel" />
          ) : (
            <>
              <p className="text-h2 text-text">You have somewhere to go.</p>
              <p className="mt-4 text-body-lg text-text-secondary">
                Achivii turns it into a 90-day journey, with one focused step every day.
              </p>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-h-[100dvh] flex-col">
        <header className="relative isolate overflow-hidden px-gutter pb-6 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
          <img src={IMAGE} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_35%] opacity-30" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-background/40 to-background" />
          <HomeLink />
        </header>

        <main id="main" className="flex flex-1 flex-col px-gutter pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4 lg:justify-center lg:px-16 lg:py-16">
          <div className="mx-auto w-full max-w-sm">
            {pathway && (
              <Surface padding="sm" className="mb-8 lg:hidden">
                <PathwaySummary pathway={pathway} size="card" />
              </Surface>
            )}
            <h1 ref={headingRef} tabIndex={-1} className="text-h2 text-text outline-none">
              {title}
            </h1>
            <p className="mt-3 text-body text-text-secondary">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
};
