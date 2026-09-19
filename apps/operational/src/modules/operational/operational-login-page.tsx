import { DAlert, DButton, DCard, DInput, useToast } from '@digvation/ui';
import { Building2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type TransitionEvent } from 'react';

import type { AuthPort, AuthSession } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import './operational-login-page.css';

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

function prefersImmediateFocus(): boolean {
  // Focusing on touch devices would open the keyboard over the brand before the user acts.
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}

/** The runtime logo, or the product mark on the brand tile, as used by the Operational shell. */
function BrandTile({ logoUrl, className }: { logoUrl?: string | undefined; className: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] ${
        logoUrl
          ? 'border border-[var(--color-border)] bg-[var(--color-surface)]'
          : 'bg-[var(--color-brand)] text-[var(--color-brand-foreground)]'
      }`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-contain p-1" />
      ) : (
        <Building2 className="size-5" strokeWidth={2.1} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Abstract composition from the Operational selling vocabulary: a catalog item,
 * a queue ticket in progress and a receipt slip. Purely presentational.
 */
function OperationalMotif() {
  return (
    <div className="operational-login__motif" aria-hidden="true">
      <div className="operational-login__tile operational-login__tile--item">
        <span className="operational-login__media" />
        <span className="operational-login__bar operational-login__bar--wide" />
        <span className="operational-login__item-footer">
          <span className="operational-login__bar operational-login__bar--short operational-login__bar--strong" />
          <span className="operational-login__add" />
        </span>
      </div>
      <div className="operational-login__tile operational-login__tile--ticket">
        <span className="operational-login__status" />
        <span className="operational-login__bar operational-login__bar--wide" />
        <span className="operational-login__bar operational-login__bar--short" />
      </div>
      <div className="operational-login__tile operational-login__tile--receipt">
        <span className="operational-login__bar operational-login__bar--wide" />
        <span className="operational-login__bar operational-login__bar--short" />
        <span className="operational-login__rule" />
        <span className="operational-login__total">
          <span className="operational-login__bar operational-login__bar--short" />
          <span className="operational-login__bar operational-login__bar--amount" />
        </span>
      </div>
    </div>
  );
}

type FieldErrors = { identifier?: string; password?: string };

/**
 * Operational sign-in. It shares the Backoffice product-family structure (split
 * card, brand identity, form proportions) with an Operational identity drawn
 * from live selling: counter, queue and receipt.
 */
export function OperationalLoginPage({ authPort, onAuthenticated }: OperationalLoginPageProps) {
  const { branding } = useDeploymentBootstrap();
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isLeaving, setLeaving] = useState(false);
  const [failedAttempt, setFailedAttempt] = useState(0);
  const [autoFocusIdentifier] = useState(prefersImmediateFocus);
  const identifierInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    // Return focus to the password once the form is interactive again after a failed attempt.
    if (failedAttempt > 0) passwordInput.current?.focus();
  }, [failedAttempt]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isLeaving) return;

    const missing: FieldErrors = {
      ...(identifier.trim() ? {} : { identifier: copy('Enter your user ID.') }),
      ...(password ? {} : { password: copy('Enter your password.') }),
    };
    if (missing.identifier || missing.password) {
      setError(null);
      setFieldErrors(missing);
      (missing.identifier ? identifierInput : passwordInput).current?.focus();
      return;
    }

    setFieldErrors({});
    setError(null);
    setSubmitting(true);
    try {
      const session = await authPort.login({ identifier: identifier.trim(), password });
      authenticatedSession.current = session;
      showToast({
        title: copy('Signed in'),
        variant: 'success',
      });
      setLeaving(true);
    } catch (failure) {
      setSubmitting(false);
      setError(loginFailureMessage(failure, copy));
      setFailedAttempt((attempt) => attempt + 1);
    }
  };

  const update = (field: keyof FieldErrors, set: (value: string) => void) => (value: string) => {
    set(value);
    if (error) setError(null);
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const busy = isSubmitting || isLeaving;

  return (
    <main
      className={`operational-login operational-view-enter h-full overflow-y-auto transition-[opacity,transform] duration-200 ease-out ${
        isLeaving ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
      onTransitionEnd={completeTransition}
    >
      <div className="operational-login__viewport grid min-h-full place-items-center">
        <DCard className="operational-login__card w-full max-w-[880px]">
          <aside className="operational-login__identity">
            <div className="operational-login__compact-identity flex min-w-0 items-center gap-3">
              <BrandTile logoUrl={branding.logoUrl} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
                  {branding.productName}
                </p>
                <p className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
                  {branding.companyName ?? copy('Operational')}
                </p>
              </div>
              <span className="operational-login__app-label shrink-0">{copy('Operational')}</span>
            </div>

            <div className="operational-login__brand items-center gap-3">
              <BrandTile logoUrl={branding.logoUrl} className="size-10" />
              <p className="min-w-0 truncate text-sm font-semibold text-[var(--color-text)]">
                {branding.productName}
              </p>
            </div>

            <OperationalMotif />

            <div className="operational-login__caption relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">
                {copy('Operational')}
              </p>
              <p className="mt-2 text-[1.375rem] font-semibold leading-7 tracking-[-0.02em] text-[var(--color-text)]">
                {copy('Run the business today.')}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
                {copy('Selling, queue and service work in one place.')}
              </p>
            </div>
          </aside>

          <section className="operational-login__form">
            <div className="operational-login__form-content mx-auto w-full max-w-[380px]">
              <h1 className="text-2xl font-bold leading-8 tracking-[-0.02em] text-[var(--color-text)]">
                {copy('Sign in to Operational')}
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
                {copy('Use your account to start working.')}
              </p>

              <form className="mt-7" autoComplete="on" onSubmit={submit} noValidate>
                <div className="space-y-4">
                  <DInput
                    ref={identifierInput}
                    id="operational-identifier"
                    name="username"
                    label={copy('User ID')}
                    value={identifier}
                    disabled={busy}
                    onChange={update('identifier', setIdentifier)}
                    placeholder={copy('Username or email')}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus={autoFocusIdentifier}
                    error={fieldErrors.identifier}
                  />
                  <DInput
                    ref={passwordInput}
                    id="operational-password"
                    name="password"
                    label={copy('Password')}
                    type="password"
                    value={password}
                    disabled={busy}
                    onChange={update('password', setPassword)}
                    placeholder={copy('Enter your password')}
                    autoComplete="current-password"
                    error={fieldErrors.password}
                  />
                </div>
                {/* Field errors are shown under each field; this announces them together. */}
                <p role="alert" className="sr-only">
                  {[fieldErrors.identifier, fieldErrors.password].filter(Boolean).join(' ')}
                </p>
                {error ? (
                  <DAlert variant="danger" role="alert" className="mt-4">
                    {error}
                  </DAlert>
                ) : null}
                <div aria-live="polite">
                  <DButton
                    type="submit"
                    size="lg"
                    fullWidth
                    className="mt-6"
                    loading={busy}
                    disabled={busy}
                  >
                    {isLeaving
                      ? copy('Opening Operational...')
                      : isSubmitting
                        ? copy('Signing in...')
                        : copy('Sign in')}
                  </DButton>
                </div>
              </form>
            </div>
          </section>
        </DCard>
      </div>
    </main>
  );
}
