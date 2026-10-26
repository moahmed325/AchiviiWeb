import React from 'react';
import { Check, Clock } from 'lucide-react';

const STEPS = [
  'Draft three title and thumbnail pairs for your next video.',
  'Write a 30-second opening hook for the strongest one.',
  'Read it aloud once and cut every line that isn’t needed.',
];

/** A still picture of one day in Achivii, so a visitor sees the product before reading about it. */
export const TodayPreview: React.FC<{ className?: string }> = ({ className = '' }) => (
  <figure className={className}>
    <div
      role="img"
      aria-label="Example of a day in Achivii: day 27 of 90, a 60-minute session on thumbnail framing and a 30-second hook, with the reason for today, three steps and a ten-minute version for busy days."
      className="rounded-panel border border-border-strong bg-surface p-6 shadow-raised sm:p-8"
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-4 font-ui-mono text-micro uppercase text-text-secondary">
          <p className="whitespace-nowrap">Week 4 · Foundation</p>
          <p className="tabular whitespace-nowrap">
            Day <span className="text-achievement">27</span> / 90
          </p>
        </div>
        <div className="mt-4 h-[3px] w-full rounded-full bg-border">
          <div className="h-full w-[30%] rounded-full bg-achievement" />
        </div>

        <p className="mt-7 font-ui-mono text-micro uppercase text-achievement">Today’s step</p>
        <p className="mt-2 text-h3 text-text">Thumbnail framing and a 30-second hook</p>
        <p className="mt-2 flex items-center gap-2 text-small text-text-secondary">
          <Clock className="size-4" strokeWidth={1.5} />
          60 min · 18:00 – 19:00
        </p>

        <div className="mt-6 rounded-block border-l-2 border-achievement bg-background px-4 py-3">
          <p className="font-ui-mono text-micro uppercase text-achievement">Why today</p>
          <p className="mt-1 text-small text-text-secondary">You film on Saturday. The first 30 seconds decide whether anyone stays.</p>
        </div>

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-small text-text">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  index === 0 ? 'border-achievement bg-achievement text-background' : 'border-border-strong text-transparent'
                }`}
              >
                <Check className="size-3" strokeWidth={2.5} />
              </span>
              <span className={index === 0 ? 'text-text-secondary line-through decoration-text-muted' : ''}>{step}</span>
            </li>
          ))}
        </ol>

        <p className="mt-6 border-t border-border pt-5 text-small text-text-secondary">
          <span className="text-text">Short on time?</span> Write one hook and read it aloud. 10 min.
        </p>
      </div>
    </div>
    <figcaption className="mt-3 text-center font-ui-mono text-micro uppercase text-text-muted">
      Example · from the YouTube pathway
    </figcaption>
  </figure>
);
