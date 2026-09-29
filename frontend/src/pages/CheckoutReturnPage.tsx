import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Button, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fetchBillingEntitlement } from '../lib/api';
type SyncState = 'checking' | 'pending' | 'verified' | 'not_verified' | 'error';
export const CheckoutReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams(); const { token, loading: authLoading } = useAuth();
  const [state,setState]=useState<SyncState>('checking'); const [attempt,setAttempt]=useState(0); const [message,setMessage]=useState('Checking your Pro subscription with Achivii…');
  const cancelled=searchParams.get('checkout')==='cancelled'; const returnedFromCheckout=searchParams.get('checkout')==='success'||cancelled;
  const verify=useCallback(async()=>{ if(authLoading)return; if(!token){setState('error');setMessage('Please sign in again to verify your subscription.');return;} setState('checking');setMessage('Checking your Pro subscription with Achivii…'); try{const entitlement=await fetchBillingEntitlement(token);if(entitlement.entitled){setState('verified');setMessage('Your Pro access is verified.');return;}setState(cancelled?'not_verified':'pending');setMessage(cancelled?'The checkout was cancelled. No Pro access was granted.':'Your payment is being synchronized. This can take a moment.');}catch(e){setState('error');setMessage(e instanceof Error?e.message:'We could not verify your subscription yet.');}},[authLoading,token,cancelled]);
  useEffect(()=>{void verify();},[verify,attempt]); useEffect(()=>{if(state!=='pending'||attempt>=4||!returnedFromCheckout||cancelled)return;const t=window.setTimeout(()=>setAttempt(v=>v+1),2500);return()=>window.clearTimeout(t);},[state,attempt,returnedFromCheckout,cancelled]);
  return <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-6 py-12"><section className="w-full rounded-card border border-border bg-surface p-8 text-center shadow-subtle" aria-live="polite">
    {state==='checking'&&<Spinner className="mx-auto"/>}{state==='pending'&&<Clock3 aria-hidden="true" className="mx-auto size-10 text-achievement"/>}{state==='verified'&&<CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-achievement"/>}{(state==='not_verified'||state==='error')&&<XCircle aria-hidden="true" className="mx-auto size-10 text-text-secondary"/>}
    <h1 className="mt-5 text-h2 text-text">{state==='verified'?'Pro is ready.':state==='pending'?'Finishing your subscription…':cancelled?'Checkout cancelled.':state==='error'?'We could not verify Pro yet.':'Checking your subscription…'}</h1><p className="mx-auto mt-3 max-w-lg text-body text-text-secondary">{message}</p>
    {state==='pending'&&<p className="mt-3 text-small text-text-secondary">We will only unlock Pro after the verified subscription reaches your account.</p>}{(state==='pending'||state==='error')&&<Button className="mt-6" variant="secondary" onClick={()=>setAttempt(v=>v+1)} trailingIcon={<RefreshCw aria-hidden="true" className="size-4"/>}>Check again</Button>}{state==='verified'&&<Button className="mt-6" variant="primary" onClick={()=>window.location.assign('/')}>Continue to Achivii</Button>}{state==='not_verified'&&<Button className="mt-6" variant="secondary" onClick={()=>window.location.assign('/')}>Return to Achivii</Button>}
  </section></main>;
}; export default CheckoutReturnPage;
