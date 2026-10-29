import React, { useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '../ui';
import { firstStepShareText } from '../../lib/firstStep';
import { renderShareCard } from '../../lib/shareCard';

interface FirstStepShareProps {
  goalText: string;
  dayNumber: number;
}

const FILE_NAME = 'achivii-day-1.png';

/** The phone's share sheet takes an image only where the browser says it can; elsewhere the card is downloaded. */
const canShareFiles = () => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], FILE_NAME, { type: 'image/png' })] });
  } catch {
    return false;
  }
};

/**
 * The first step, marked: the 90 days lit up to this day, then an optional card to share the start. Sharing is never
 * required and nothing is posted for the person; each button opens their own share menu, X, LinkedIn or a download.
 */
export const FirstStepShare: React.FC<FirstStepShareProps> = ({ goalText, dayNumber }) => {
  const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle');
  const site = window.location.host;
  const text = firstStepShareText(goalText, dayNumber);
  const url = window.location.origin;
  const progress = `${Math.max(3, Math.round((dayNumber / 90) * 100))}%`;

  const withCard = async (handle: (file: File) => Promise<void> | void) => {
    setStatus('working');
    try {
      const blob = await renderShareCard({ goalText, dayNumber, site });
      await handle(new File([blob], FILE_NAME, { type: 'image/png' }));
      setStatus('idle');
    } catch (error) {
      // Closing the share menu is not a failure.
      setStatus(error instanceof DOMException && error.name === 'AbortError' ? 'idle' : 'failed');
    }
  };

  const download = (file: File) => {
    const href = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = href;
    link.download = FILE_NAME;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <section aria-labelledby="first-step-heading" className="mt-8 rounded-card border border-achievement/30 bg-background/50 p-5 sm:p-6">
      <h3 id="first-step-heading" className="text-h3 text-text">
        Your first step is done.
      </h3>
      <p className="mt-1 text-small text-text-secondary">That’s how 90 days start: one step, then the next.</p>

      <div aria-hidden="true" className="mt-5">
        <div className="relative h-px bg-border-strong">
          <span className="absolute inset-y-0 left-0 origin-left animate-line-fill bg-achievement motion-reduce:animate-none" style={{ width: progress }} />
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-achievement" style={{ left: progress }} />
          <span className="absolute right-0 top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-achievement bg-surface" />
        </div>
        <div className="mt-3 flex justify-between text-small">
          <span className="tabular text-text">Day {dayNumber}</span>
          <span className="text-achievement-hover">Day 90</span>
        </div>
      </div>

      <figure className="mt-6">
        <div
          role="img"
          aria-label={`Share card: Day ${dayNumber} of 90, ${goalText}.`}
          className="flex flex-col justify-between gap-6 rounded-block border border-achievement/35 bg-background p-5 sm:aspect-[40/21] sm:gap-0 sm:p-[5%]"
        >
          <div aria-hidden="true" className="flex items-baseline justify-between gap-3 text-small">
            <span className="font-medium text-text">Achivii</span>
            <span className="truncate text-text-secondary">One step a day · {site}</span>
          </div>
          <div aria-hidden="true">
            <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Day {dayNumber} of 90</p>
            <p className="mt-1.5 line-clamp-2 text-h3 text-text">{goalText}</p>
          </div>
          <div aria-hidden="true" className="relative h-px bg-border-strong">
            <span className="absolute inset-y-0 left-0 bg-achievement" style={{ width: progress }} />
            <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-achievement" style={{ left: progress }} />
            <span className="absolute right-0 top-1/2 size-2 -translate-y-1/2 rounded-full border border-achievement bg-background" />
          </div>
        </div>
        <figcaption className="mt-2 text-small text-text-secondary">Share your start, if you like. It helps to say it out loud.</figcaption>
      </figure>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {canShareFiles() ? (
          <Button
            variant="gold"
            loading={status === 'working'}
            leadingIcon={<Share2 aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            onClick={() => withCard((file) => navigator.share({ files: [file], text, url }))}
          >
            Share
          </Button>
        ) : (
          <>
            <Button asChild variant="secondary" size="sm">
              <a href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
                Post on X
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
                Post on LinkedIn
              </a>
            </Button>
          </>
        )}
        <Button
          variant="quiet"
          size="sm"
          loading={status === 'working'}
          leadingIcon={<Download aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          onClick={() => withCard(download)}
        >
          Download image
        </Button>
      </div>
      <p role="alert" className="mt-3 text-small text-danger empty:hidden">
        {status === 'failed' ? 'The image couldn’t be made in this browser.' : ''}
      </p>
    </section>
  );
};
