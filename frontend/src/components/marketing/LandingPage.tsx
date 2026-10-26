import React from 'react';
import { SkipLink } from '../ui';
import { MarketingNav } from './MarketingNav';
import { Hero } from './sections/Hero';
import { Pathways } from './sections/Pathways';
import { HowItWorks } from './sections/HowItWorks';
import { WhyItWorks } from './sections/WhyItWorks';
import { Pricing } from './sections/Pricing';
import { Faq } from './sections/Faq';
import { FinalCta } from './sections/FinalCta';
import { MarketingFooter } from './sections/MarketingFooter';

/**
 * The signed-out page. Most visitors arrive from social posts without a goal in mind, so the order follows their
 * questions: what is this, which goal could I pick, what is a day like, why trust it, what does it cost.
 */
export const LandingPage: React.FC<{ apiOffline: boolean }> = ({ apiOffline }) => (
  <div className="marketing relative min-h-[100dvh] w-full bg-background text-left text-text antialiased">
    <SkipLink />
    <MarketingNav apiOffline={apiOffline} />
    <main id="main">
      <Hero />
      <Pathways />
      <HowItWorks />
      <WhyItWorks />
      <Pricing />
      <Faq />
      <FinalCta />
    </main>
    <MarketingFooter />
  </div>
);
