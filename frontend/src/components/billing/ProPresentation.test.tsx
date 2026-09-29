import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProPresentation } from './ProPresentation';
describe('ProPresentation', () => {
  it('explains Pro without inventing pricing', () => { render(<ProPresentation onContinue={()=>undefined}/>); expect(screen.getByRole('heading',{name:'Make the journey yours.'})).toBeInTheDocument(); expect(screen.getByText('Create Custom Goals')).toBeInTheDocument(); expect(screen.getByText(/Pricing is shown by the configured checkout/i)).toBeInTheDocument(); });
  it('emits the selected billing interval', async () => { const user=userEvent.setup(); const onIntervalChange=vi.fn(); render(<ProPresentation onIntervalChange={onIntervalChange} onContinue={()=>undefined}/>); await user.click(screen.getByRole('button',{name:'Yearly'})); expect(onIntervalChange).toHaveBeenCalledWith('yearly'); });
});
