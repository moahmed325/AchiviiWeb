import React from 'react';
import { SkipLink } from '../ui';
import { MarketingNav } from './MarketingNav';
import { ScrollThread } from './ScrollThread';
import { Hero } from './sections/Hero';
import { Proof } from './sections/Proof';
import { Method } from './sections/Method';
import { Product } from './sections/Product';
import { Pathways } from './sections/Pathways';
import { Premium } from './sections/Premium';
import { Faq } from './sections/Faq';
import { FinalCta } from './sections/FinalCta';
import { MarketingFooter } from './sections/MarketingFooter';

export const LandingPage: React.FC<{ apiOffline: boolean }> = ({ apiOffline }) => (
  <div className="marketing relative min-h-[100dvh] w-full bg-background text-left text-text antialiased">
    <SkipLink />
    <ScrollThread />
    <MarketingNav apiOffline={apiOffline} />
    <main id="main">
      <Hero />
      <Proof />
      <Method />
      <Product />
      <Pathways />
      <Premium />
      <Faq />
      <FinalCta />
    </main>
    <MarketingFooter />
    <div aria-hidden="true" className="grain-overlay" />
  </div>
);