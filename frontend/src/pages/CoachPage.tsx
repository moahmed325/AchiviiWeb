import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Surface } from '../components/ui';

export const CoachPage: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-12 sm:py-16">
    <header className="max-w-2xl">
      <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">More ways to climb</p>
      <h1 className="mt-4 text-h1 text-text">Achivii Coach</h1>
      <p className="mt-4 text-body-lg text-text-secondary">
        A thoughtful space to talk through a hard week, understand a step, and shape your plan in conversation.
      </p>
    </header>
    <Surface as="section" aria-labelledby="coach-coming-title" tone="base" padding="lg" radius="panel" className="mt-10">
      <div className="flex size-12 items-center justify-center rounded-full bg-achievement/[0.12] text-achievement">
        <MessageCircle aria-hidden="true" strokeWidth={1.5} className="size-6" />
      </div>
      <h2 id="coach-coming-title" className="mt-6 text-h3 text-text">Coming soon</h2>
      <p className="mt-2 max-w-xl text-body text-text-secondary">
        Coach is still in development. There is no conversation to start yet, and nothing to purchase here.
      </p>
    </Surface>
  </main>
);

export default CoachPage;
