import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, ErrorState, Spinner } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { fetchBillingEntitlement, startProCheckout } from '../../lib/api';
import { ProPresentation } from './ProPresentation';
export const CustomGoalGate: React.FC<{ onContinue: () => void }> = ({ onContinue }) => {
 const { token }=useAuth(); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null); const [entitled,setEntitled]=useState(false); const [checkoutLoading,setCheckoutLoading]=useState(false); const [interval,setInterval]=useState<'monthly'|'yearly'>('monthly');
 const load=useCallback(async()=>{if(!token){setLoading(false);setError('Please sign in to check Pro access.');return;}setLoading(true);setError(null);try{setEntitled((await fetchBillingEntitlement(token)).entitled);}catch(e){setError(e instanceof Error?e.message:'Unable to load Pro access.');}finally{setLoading(false);}},[token]);
 useEffect(()=>{void load();},[load]);
 if(loading)return <div role="status" className="flex items-center gap-2 text-small text-text-secondary"><Spinner/> Checking Pro accessâ€¦</div>;
 if(error)return <ErrorState title="We couldn't check Pro access" description={error} onRetry={()=>void load()}/>;
 if(entitled)return <Button variant="primary" trailingIcon={<ArrowRight aria-hidden="true" className="size-4"/>} onClick={onContinue}>Create a custom journey</Button>;
 const beginCheckout=async()=>{if(!token)return;setCheckoutLoading(true);setError(null);try{const checkout=await startProCheckout(token,interval);window.location.assign(checkout.checkoutUrl);}catch(e){setError(e instanceof Error?e.message:'Unable to start checkout. Please try again.');setCheckoutLoading(false);}};
 return <div className="space-y-4" aria-live="polite"><ProPresentation selectedInterval={interval} onIntervalChange={setInterval} onContinue={beginCheckout}/>{checkoutLoading&&<p role="status" className="flex items-center gap-2 text-small text-text-secondary"><Spinner/> Opening secure checkoutâ€¦</p>}</div>;
};
