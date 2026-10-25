import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Field, IconButton, Input, LoadingState, TextLink } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { describeAuthError, validateEmail, validatePassword } from '../../lib/authFlow';
import { AuthLayout } from './AuthLayout';
import { FormAlert } from './AuthScreen';

// B-15: password reset. Supabase emails a link to /reset-password, which opens signed in for recovery; the person sets a
// new password there and stays signed in. The sent line never says whether an account exists for the email.

export const RESET_SENT_LINE = 'If an account exists for that email, a reset link is on its way. Check your inbox.';
export const RESET_LINK_EXPIRED_LINE = 'This reset link has expired or was already used.';

export const ForgotPasswordPage: React.FC = () => {
  const { requestPasswordReset } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const found = validateEmail(email);
    setEmailError(found);
    if (found) {
      emailRef.current?.focus();
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      setFormError(describeAuthError(error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" description="Enter the email you signed up with and we'll send you a link to choose a new password.">
      {sent ? (
        <p role="status" className="text-body text-text">
          {RESET_SENT_LINE}
        </p>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field label="Email" error={emailError}>
            <Input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          {formError && <FormAlert>{formError}</FormAlert>}
          <Button type="submit" size="lg" fullWidth loading={pending} className="mt-1">
            {pending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
      <p className="mt-8 text-small text-text-secondary">
        <TextLink asChild>
          <Link to="/login">Back to sign in</Link>
        </TextLink>
      </p>
    </AuthLayout>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const { token, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    // A new password follows the sign-up rule.
    const found = validatePassword(password, 'signup');
    setPasswordError(found);
    if (found) {
      passwordRef.current?.focus();
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      await updatePassword(password);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(describeAuthError(error).message);
      setPending(false);
    }
  };

  let body: React.ReactNode;
  if (loading) {
    body = <LoadingState label="Opening your reset link…" showLabel />;
  } else if (!token) {
    body = (
      <>
        <FormAlert>{RESET_LINK_EXPIRED_LINE}</FormAlert>
        <p className="mt-6 text-small text-text-secondary">
          <TextLink asChild>
            <Link to="/forgot-password">Send a new link</Link>
          </TextLink>
        </p>
      </>
    );
  } else {
    body = (
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field label="New password" hint="At least 6 characters." error={passwordError}>
          <Input
            ref={passwordRef}
            type={showPassword ? 'text' : 'password'}
            name="new-password"
            autoComplete="new-password"
            autoCapitalize="none"
            spellCheck={false}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
        {formError && <FormAlert>{formError}</FormAlert>}
        <Button type="submit" size="lg" fullWidth loading={pending} className="mt-1">
          {pending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    );
  }

  return (
    <AuthLayout title="Choose a new password" description="Pick a new password for your Achivii account.">
      {body}
    </AuthLayout>
  );
};
