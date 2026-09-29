import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Wordmark } from '../components/marketing/Wordmark';

/**
 * Draft legal/support pages for store review readiness.
 *
 * NOTE FOR OPERATOR (review before treating as final):
 * - These pages state only factual product behavior; they deliberately omit
 *   legal entity names, registration numbers, addresses, tax IDs, governing
 *   law, and refund guarantees. Add those only after confirming the real
 *   business details.
 * - The refund/cancellation page describes Lemon Squeezy's subscription
 *   lifecycle (cancel at period end; access continues to the period end)
 *   without inventing a refund promise. If a refund policy is decided,
 *   add it here explicitly.
 */

const SITE = 'https://achiviiweb.vercel.app';
const CONTACT_EMAIL = 'moahmedsaeed325@gmail.com';

type DocKey = 'terms' | 'privacy' | 'refunds' | 'contact';

const DOCS: Record<DocKey, { title: string; updated: string; sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }> }> = {
  terms: {
    title: 'Terms of Service',
    updated: 'September 30, 2026',
    sections: [
      {
        heading: 'About the service',
        paragraphs: [
          'Achivii is a web application that helps you turn a personal goal into a structured 90-day plan. It generates a daily practice schedule from certified pathway content or from a custom goal you describe, tracks your progress, and adapts upcoming weeks based on the weekly reviews you submit.',
          'Achivii is provided as software. All plans, schedules and weekly adaptations are produced automatically by the application.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'You need an account with a valid email address and password to use Achivii. You are responsible for keeping your credentials secure and for the activity that happens under your account.',
        ],
      },
      {
        heading: 'Subscriptions and billing',
        paragraphs: [
          'Achivii Pro is an optional subscription that unlocks creating custom goals beyond the free certified pathways. Billing and payments are handled by our merchant of record, Lemon Squeezy. When you subscribe, Lemon Squeezy processes your payment and provides subscription management, including cancellation.',
          'Subscriptions renew automatically at the interval you choose (monthly or yearly) until cancelled. Cancelling stops future renewals; access continues until the end of the period you have already paid for.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Do not misuse the service: do not attempt to access other users\' data, disrupt the service, or use automated means to abuse it. We may suspend accounts that put the service or other users at risk.',
        ],
      },
      {
        heading: 'Availability and changes',
        paragraphs: [
          'We work to keep Achivii available and may add, change or remove features over time. If we make a material change to these terms, we will update this page with a new date.',
        ],
      },
      {
        heading: 'No professional advice; no guaranteed outcomes',
        paragraphs: [
          'Achivii provides planning and organizational tools. It does not provide medical, psychological, financial or legal advice, and it does not guarantee that you will achieve any particular result. What you accomplish depends on your own effort and circumstances.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Questions about these terms: ${CONTACT_EMAIL}`],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'September 30, 2026',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: ['Achivii collects the minimum data needed to run the product:'],
        bullets: [
          'Account data: your email address and a salted, hashed password.',
          'Product data: the goal you describe, your schedule preferences, daily task completions, weekly reviews and related progress data.',
          'Billing data handled by Lemon Squeezy: subscription status and provider identifiers needed to grant Pro access. Achivii never receives or stores your full card details.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'Your data is used to operate your account, generate and adapt your 90-day plan, track your progress, verify your subscription status, and provide support. We do not sell your personal data.',
        ],
      },
      {
        heading: 'Service providers',
        paragraphs: [
          'Hosting and databases for the application are provided by Render. Payments, receipts and subscription management are provided by Lemon Squeezy as merchant of record. AI-assisted planning features may send the text of your goal description to AI providers to generate your plan content.',
        ],
      },
      {
        heading: 'Retention and your choices',
        paragraphs: [
          'Your goal and progress data are kept while your account is active. You can contact us to request deletion of your account and personal data. You can manage or cancel your subscription at any time through the subscription management link in your account menu.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Privacy questions and data deletion requests: ${CONTACT_EMAIL}`],
      },
    ],
  },
  refunds: {
    title: 'Refund & Cancellation Policy',
    updated: 'September 30, 2026',
    sections: [
      {
        heading: 'Cancelling your subscription',
        paragraphs: [
          'You can cancel Achivii Pro at any time from your Achivii account menu, which opens Lemon Squeezy\'s subscription management portal. Cancelling stops all future renewals.',
        ],
      },
      {
        heading: 'Access after cancellation',
        paragraphs: [
          'When you cancel, your Pro access continues until the end of the billing period you have already paid for, then ends automatically. Your existing goals and progress remain available on the free plan; only creating new custom goals requires Pro.',
        ],
      },
      {
        heading: 'Refunds',
        paragraphs: [
          'Payments are processed by Lemon Squeezy as merchant of record, and its payment and refund terms apply to transactions. If you believe a charge was made in error, contact us and we will work with you and Lemon Squeezy to resolve it.',
        ],
      },
      {
        heading: 'Failed payments',
        paragraphs: [
          'If a renewal payment fails, Lemon Squeezy will retry it. Your plan status in Achivii follows the verified subscription state from Lemon Squeezy, and access ends only when the provider reports the subscription as expired.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [`Billing questions: ${CONTACT_EMAIL}`],
      },
    ],
  },
  contact: {
    title: 'Contact & Support',
    updated: 'September 30, 2026',
    sections: [
      {
        heading: 'Support',
        paragraphs: [
          `For help with your account, your 90-day plan, or billing, email ${CONTACT_EMAIL} and we will get back to you.`,
        ],
      },
      {
        heading: 'Subscription management',
        paragraphs: [
          'You can view your current plan, and manage or cancel your Pro subscription, from the Account menu inside the app. Subscription management is provided by Lemon Squeezy.',
        ],
      },
      {
        heading: 'Links',
        paragraphs: [`Product: ${SITE}`],
      },
    ],
  },
};

const LegalPage: React.FC = () => {
  const { doc } = useParams<{ doc: string }>();
  const content = DOCS[doc as DocKey];
  if (!content) return <Navigate to="/" replace />;

  return (
    <div className="marketing min-h-[100dvh] bg-background text-text">
      <div className="mx-auto w-full max-w-[46rem] px-6 pb-20 pt-16 sm:px-10 sm:pt-24">
        <Link to="/" className="focus-ring inline-flex min-h-11 items-center rounded-full" aria-label="Achivii, home">
          <Wordmark />
        </Link>
        <h1 className="mt-10 text-[clamp(2.25rem,4.6vw,3.25rem)] font-semibold leading-[1.05] tracking-[-0.03em]">{content.title}</h1>
        <p className="mt-2 font-ui-mono text-xs uppercase tracking-[0.16em] text-text-secondary">Last updated {content.updated}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="mt-10">
            <h2 className="text-xl font-medium tracking-[-0.02em]">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 32)} className="mt-3 text-[16px] leading-relaxed text-text-secondary">{p}</p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[16px] leading-relaxed text-text-secondary">
                {section.bullets.map((b) => <li key={b.slice(0, 32)}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}
        <p className="mt-14 text-sm text-text-secondary">
          Read also our{' '}
          <Link className="underline hover:text-text" to="/legal/terms">Terms of Service</Link>,{' '}
          <Link className="underline hover:text-text" to="/legal/privacy">Privacy Policy</Link> and{' '}
          <Link className="underline hover:text-text" to="/legal/refunds">Refund &amp; Cancellation Policy</Link>.
        </p>
      </div>
    </div>
  );
};

export default LegalPage;
