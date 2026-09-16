import {
  AuthProvider,
  type AuthPort,
  type AuthSession,
  type SessionEndReason,
} from '@digvation/business-auth';
import {
  ConnectivityProvider,
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DLocalizationProvider, DToastProvider as ToastProvider, useToast } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TransitionEvent,
} from 'react';

import { operationalCopy, type OperationalLocale } from '../localization/operational-localization';
import { OperationalLoginPage } from '../../modules/operational/operational-login-page';
import { OperationalSessionProvider } from '../../modules/operational/operational-session-provider';
import { PosOperationalSessionProvider } from '../../modules/pos/pos-operational-session-provider';

function runtimeLocale(locale: string): OperationalLocale {
  return locale === 'en-US' ? 'en-US' : 'id-ID';
}

function hasImplementedOperationalSurface(session: AuthSession): boolean {
  const permissions = session.access.permissions;
  const hasPos =
    session.access.products.includes('POS') &&
    permissions.some((permission) => permission.startsWith('sales:'));
  const hasExpenses =
    session.access.capabilities.includes('FINANCE_OPERATIONS') &&
    permissions.some((permission) => permission.startsWith('expenses:'));
  return hasPos || hasExpenses;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});

interface OperationalProvidersProps {
  bootstrap: DeploymentBootstrapConfig;
  session: AuthSession | null;
  authPort: AuthPort;
  router: RouterProviderProps['router'];
}

type OperationalAuthBoundaryProps = Omit<OperationalProvidersProps, 'bootstrap'>;

function OperationalAuthBoundary({
  session,
  authPort,
  router,
}: OperationalAuthBoundaryProps) {
  const [authenticatedSession, setAuthenticatedSession] = useState(session);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const sessionEnded = useRef(false);
  const { showToast } = useToast();

  const locale = runtimeLocale(authenticatedSession?.preferences.locale ?? 'id-ID');
  const copy = (value: string) => operationalCopy(value, locale);

  const handleSessionEnded = useCallback(
    (_reason: SessionEndReason) => {
      if (sessionEnded.current) return;
      sessionEnded.current = true;
      setLoggingOut(false);
      setAuthenticatedSession(null);
      showToast({
        variant: 'warning',
        title: copy('Your session has ended. Sign in again.'),
      });
      void authPort.logout();
    },
    [authPort, copy, showToast],
  );

  useEffect(() => {
    if (!authPort.subscribeSessionEnded) return undefined;
    return authPort.subscribeSessionEnded(handleSessionEnded);
  }, [authPort, handleSessionEnded]);

  const handleAuthenticated = useCallback((nextSession: AuthSession) => {
    sessionEnded.current = false;
    setAuthenticatedSession(nextSession);
  }, []);

  const completeLogoutTransition = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!isLoggingOut) return;
    setAuthenticatedSession(null);
    setLoggingOut(false);
  };

  if (!authenticatedSession) {
    return <OperationalLoginPage authPort={authPort} onAuthenticated={handleAuthenticated} />;
  }

  const allowed =
    authenticatedSession.access.foundations.includes('OPERATIONAL_ACCESS') &&
    hasImplementedOperationalSurface(authenticatedSession);

  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
        <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-lg font-semibold">{copy('Operational access unavailable')}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {copy('Contact an administrator if this access should be available.')}
          </p>
        </section>
      </main>
    );
  }

  return (
    <AuthProvider
      session={authenticatedSession}
      authPort={authPort}
      onLogout={() => setLoggingOut(true)}
    >
      <DLocalizationProvider locale={runtimeLocale(authenticatedSession.preferences.locale)}>
        <OperationalSessionProvider>
          <PosOperationalSessionProvider>
            <div
              className={`min-h-screen transition-[opacity,transform] duration-150 ease-out ${
                isLoggingOut ? 'pointer-events-none -translate-y-1 opacity-0' : 'opacity-100'
              }`}
              onTransitionEnd={completeLogoutTransition}
            >
              <RouterProvider router={router} />
            </div>
          </PosOperationalSessionProvider>
        </OperationalSessionProvider>
      </DLocalizationProvider>
    </AuthProvider>
  );
}

export function OperationalProviders({
  bootstrap,
  session,
  authPort,
  router,
}: OperationalProvidersProps) {
  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <ConnectivityProvider>
        <QueryClientProvider client={queryClient}>
          <DLocalizationProvider locale={runtimeLocale(bootstrap.defaults.locale)}>
            <ToastProvider>
              <OperationalAuthBoundary
                session={session}
                authPort={authPort}
                router={router}
              />
            </ToastProvider>
          </DLocalizationProvider>
        </QueryClientProvider>
      </ConnectivityProvider>
    </DeploymentBootstrapProvider>
  );
}
