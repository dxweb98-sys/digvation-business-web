import { DButton, DInput, useToast } from '@digvation/ui';
import { Building2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type TransitionEvent } from 'react';

import type { AuthPort, AuthSession } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useOperationalLocalization } from '../../app/localization/operational-localization';

interface OperationalLoginPageProps {
  authPort: AuthPort;
  onAuthenticated: (session: AuthSession) => void;
}

function loginFailureMessage(error: unknown, copy: (value: string) => string) {
  if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
    return copy('Invalid user ID or password.');
  }
  return copy('Sign in failed. Try again.');
}

/** Operational-owned login composition using the canonical shared field, button, and toast primitives. */
export function OperationalLoginPage({ authPort, onAuthenticated }: OperationalLoginPageProps) {
  const bootstrap = useDeploymentBootstrap();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isLeaving, setLeaving] = useState(false);
  const authenticatedSession = useRef<AuthSession | null>(null);
  const hasCompletedTransition = useRef(false);

  const completeTransition = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!isLeaving || hasCompletedTransition.current || !authenticatedSession.current) return;
    hasCompletedTransition.current = true;
    onAuthenticated(authenticatedSession.current);
  };

  useEffect(() => {
    if (!isLeaving) return undefined;
    // Continue into Operational even when the exit transition end is not delivered.
    const timer = window.setTimeout(() => {
      if (hasCompletedTransition.current || !authenticatedSession.current) return;
      hasCompletedTransition.current = true;
      onAuthenticated(authenticatedSession.current);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [isLeaving, onAuthenticated]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isLeaving) return;

    if (!identifier.trim() || !password) {
      showToast({
        title: copy('Complete account details'),
        description: copy('Enter user ID and password.'),
        variant: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      const session = await authPort.login({ identifier: identifier.trim(), password });
      authenticatedSession.current = session;
      showToast({
        title: copy('Signed in'),
        variant: 'success',
      });
      setLeaving(true);
    } catch (error) {
      setSubmitting(false);
      showToast({
        title: copy('Sign in failed'),
        description: loginFailureMessage(error, copy),
        variant: 'danger',
      });
    }
  };

  return (
    <main
      className={`operational-view-enter grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-4 py-8 transition-[opacity,transform] duration-200 ease-out sm:px-6 ${
        isLeaving ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
      onTransitionEnd={completeTransition}
    >
      <div className="pointer-events-none absolute left-[12%] top-[18%] size-64 rounded-full bg-[var(--color-brand)]/[0.035] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[12%] right-[14%] size-56 rounded-full bg-[var(--color-accent-lavender)]/25 blur-3xl" />

      <section className="relative w-full max-w-sm">
        <header className="mb-8 text-center">
          <div className="relative mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20">
            <Building2 className="size-6" aria-hidden="true" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[var(--color-brand)]/20 animate-ping [animation-duration:2s]" />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
            {bootstrap.branding.productName}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{copy('Operational')}</p>
        </header>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {copy('Sign in to Operational')}
          </h2>

          <form autoComplete="on" className="mt-6 space-y-4" onSubmit={submit}>
            <DInput
              id="operational-identifier"
              name="username"
              label={copy('User ID')}
              value={identifier}
              disabled={isSubmitting}
              onChange={setIdentifier}
              placeholder={copy('Username or email')}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            <DInput
              id="operational-password"
              name="password"
              label={copy('Password')}
              type="password"
              value={password}
              disabled={isSubmitting}
              onChange={setPassword}
              placeholder={copy('Password')}
              autoComplete="current-password"
            />
            <DButton type="submit" fullWidth loading={isSubmitting} className="mt-2">
              {isLeaving
                ? copy('Opening Operational...')
                : isSubmitting
                  ? copy('Signing in...')
                  : copy('Sign in')}
            </DButton>
          </form>
        </div>
      </section>
    </main>
  );
}
