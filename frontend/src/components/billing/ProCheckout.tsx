import React, { useState } from 'react';
import { useAuthToken } from '../../context/AuthContext';
import { startProCheckout } from '../../lib/api';
import { ErrorState, Spinner } from '../ui';
import { ProPresentation, type ProInterval } from './ProPresentation';

/** Pro, monthly or yearly, and the button that opens Lemon Squeezy's checkout (ND-37). */
export const ProCheckout: React.FC<{ className?: string }> = ({ className }) => {
  const token = useAuthToken();
  const [interval, setInterval] = useState<ProInterval>('monthly');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async () => {
    if (!token) return;
    setOpening(true);
    setError(null);
    try {
      const checkout = await startProCheckout(token, interval);
      window.location.assign(checkout.checkoutUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start checkout. Please try again.');
      setOpening(false);
    }
  };

  return (
    <div className={className} aria-live="polite">
      <ProPresentation selectedInterval={interval} onIntervalChange={setInterval} onContinue={opening ? undefined : begin} />
      {opening && (
        <p role="status" className="mt-4 flex items-center gap-2 text-small text-text-secondary">
          <Spinner /> Opening secure checkout…
        </p>
      )}
      {error && <ErrorState className="mt-4" title="We couldn't open checkout" description={error} onRetry={() => void begin()} />}
    </div>
  );
};
