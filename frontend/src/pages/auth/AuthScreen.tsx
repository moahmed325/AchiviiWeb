import React, { useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button, Field, IconButton, Input, LoadingState, TextLink } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import {
  authSwitchHref,
  describeAuthError,
  validateEmail,
  validatePassword,
  type AuthErrorDescription,
  type AuthMode,
} from '../../lib/authFlow';
import { findPathwayBySlug } from '../../lib/certifiedPresets';
import { AuthLayout } from './AuthLayout';
import { usePostAuthRedirect } from './usePostAuthRedirect';

const COPY = {
  signup: {
    title: 'Create your account',
    description: "It takes a minute. Then we'll shape your first 90 days around the time you have.",
    submit: 'Create account',
    pending: 'Creating your account…',
    switchPrompt: 'Already have an account?',
    switchLabel: 'Sign in',
  },
  login: {
    title: 'Welcome back',
    description: 'Sign in to pick up where you left off.',
    submit: 'Sign in',
    pending: 'Signing in…',
    switchPrompt: 'New to Achivii?',
    switchLabel: 'Create an account',
  },
} as const;

interface FieldErrors {
  email?: string;
  password?: string;
}

const FormAlert: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div role="alert" className="flex items-start gap-2.5 rounded-control border border-danger/30 bg-danger/[0.06] p-4 text-small text-text">
    <AlertCircle aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-danger" />
    <p>{children}</p>
  </div>
);

const OfflineNotice: React.FC = () => (
  <div role="status" className="mb-6 flex items-start gap-2.5 rounded-control border border-border-strong bg-surface p-4 text-small text-text-secondary">
    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-caution" />
    <p>Achivii isn't responding right now, so this may not go through. You can still try, or come back in a moment.</p>
  </div>
);

export const AuthScreen: React.FC<{ mode: AuthMode }> = ({ mode }) => {
  const copy = COPY[mode];
  const { token, login, signup } = useAuth();
  const { apiStatus } = useGoal();
  const [params] = useSearchParams();
  const location = useLocation();

  const pathway = findPathwayBySlug(params.get('pathway'));
  const next = params.get('next');
  usePostAuthRedirect(pathway, next);

  const prefillEmail = (location.state as { email?: string } | null)?.email ?? '';
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthErrorDescription | null>(null);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const validate = (values: { email: string; password: string }): FieldErrors => ({
    email: validateEmail(values.email),
    password: validatePassword(values.password, mode),
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;

    const found = validate({ email, password });
    setAttempted(true);
    setErrors(found);
    if (found.email || found.password) {
      (found.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    submitting.current = true;
    setFormError(null);
    setPending(true);
    try {
      await (mode === 'signup' ? signup(email.trim(), password) : login(email.trim(), password));
      // Stay pending: usePostAuthRedirect navigates away once the goal state is known.
    } catch (error) {
      setFormError(describeAuthError(error));
      setPending(false);
      submitting.current = false;
    }
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    if (attempted) setErrors((current) => ({ ...current, email: validateEmail(value) }));
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (attempted) setErrors((current) => ({ ...current, password: validatePassword(value, mode) }));
  };

  const loginHref = authSwitchHref('login', params);

  // Already signed in when the screen opened: show a calm wait while the redirect decides where to go.
  const redirecting = Boolean(token) && !pending;

  return (
    <AuthLayout title={copy.title} description={copy.description} pathway={pathway}>
      {redirecting ? (
        <LoadingState label="You're signed in. Taking you there…" showLabel />
      ) : (
        <>
          {apiStatus === 'offline' && <OfflineNotice />}
          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Field label="Email" error={errors.email}>
              <Input
                ref={emailRef}
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(event) => updateEmail(event.target.value)}
              />
            </Field>
            <Field
              label="Password"
              hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
              error={errors.password}
            >
              <Input
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                autoCapitalize="none"
                spellCheck={false}
                value={password}
                onChange={(event) => updatePassword(event.target.value)}
                trailing={
                  <IconButton
                    label="Show password"
                    aria-pressed={showPassword}
                    icon={showPassword ? <EyeOff aria-hidden="true" strokeWidth={1.75} className="size-5" /> : <Eye aria-hidden="true" strokeWidth={1.75} className="size-5" />}
                    onClick={() => setShowPassword((shown) => !shown)}
                  />
                }
              />
            </Field>

            {formError && (
              <FormAlert>
                {formError.message}
                {formError.kind === 'duplicate' && (
                  <>
                    {' '}
                    <TextLink asChild>
                      <Link to={loginHref} state={{ email: email.trim() }}>
                        Sign in instead
                      </Link>
                    </TextLink>
                  </>
                )}
              </FormAlert>
            )}

            <Button type="submit" size="lg" fullWidth loading={pending} className="mt-1">
              {pending ? copy.pending : copy.submit}
            </Button>
          </form>

          <p className="mt-8 text-small text-text-secondary">
            {copy.switchPrompt}{' '}
            <TextLink asChild>
              <Link to={authSwitchHref(mode === 'signup' ? 'login' : 'signup', params)}>{copy.switchLabel}</Link>
            </TextLink>
          </p>
        </>
      )}
    </AuthLayout>
  );
};
