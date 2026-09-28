import React from 'react';
import { SkipLink } from '../ui';
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

export const LandingPage: React.FC<{ apiOffline: boolean }> = ({ apiOffline }) => (
  <div className="marketing relative min-h-[100dvh] w-full bg-background text-left text-text antialiased">
    <SkipLink />
    <MarketingNav apiOffline={apiOffline} />
    <main id="main">
      <Hero />
      <Problem />
      <Method />
      <Journey />
      <Today />
      <Adaptive />
      <Pathways />
      <Premium />
      <Achievement />
      <FinalCta />
    </main>
    <MarketingFooter />
    <div aria-hidden="true" className="grain-overlay" />
  </div>
);
