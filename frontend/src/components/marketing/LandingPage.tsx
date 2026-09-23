import React from 'react';
import { MarketingNav } from './MarketingNav';
import { Hero } from './sections/Hero';
import { Problem } from './sections/Problem';
import { Method } from './sections/Method';
import { Journey } from './sections/Journey';
import { Today } from './sections/Today';
import { Adaptive } from './sections/Adaptive';
import { Pathways } from './sections/Pathways';
import { Premium } from './sections/Premium';
import { Achievement } from './sections/Achievement';
import { FinalCta } from './sections/FinalCta';
import { MarketingFooter } from './sections/MarketingFooter';

interface LandingPageProps {
  onStartJourney: () => void;
  onSignIn: () => void;
  onChoosePathway: (title: string) => void;
  apiOffline: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartJourney, onSignIn, onChoosePathway, apiOffline }) => (
  <div className="marketing relative min-h-[100dvh] w-full bg-background text-left text-text antialiased">
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-text focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-background"
    >
      Skip to content
    </a>
    <MarketingNav onStartJourney={onStartJourney} onSignIn={onSignIn} apiOffline={apiOffline} />
    <main id="main">
      <Hero onStartJourney={onStartJourney} />
      <Problem />
      <Method />
      <Journey />
      <Today />
      <Adaptive />
      <Pathways onChoosePathway={onChoosePathway} />
      <Premium />
      <Achievement />
      <FinalCta onStartJourney={onStartJourney} onSignIn={onSignIn} />
    </main>
    <MarketingFooter onSignIn={onSignIn} />
    <div aria-hidden="true" className="grain-overlay" />
  </div>
);
