import {
  AuthProvider,
  type AuthPort,
  type AuthSession,
  type SessionEndReason,
} from '@digvation/business-auth';
import {
  AuthenticatedRuntimeProjectionProvider,
  ConnectivityProvider,
  DeploymentBootstrapProvider,
  useConnectivity,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { ConnectionStateBoundary } from '@digvation/business-system-states';
import { DLocalizationProvider, DToastProvider as ToastProvider, useToast } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { useCallback, useEffect, useRef, useState, type TransitionEvent } from 'react';

import { operationalQueryClientDefaults } from '../data/operational-cache-policy';
import { operationalCopy, type OperationalLocale } from '../localization/operational-localization';
import { OperationalLoginPage } from '../auth/operational-login-page';
import { resolveOperationalSurfaceAccess } from '../../shared/operational-access/operational-surface-access';
import { OperationalAccessDenied } from '../auth/operational-access-denied';
import { OperationalSessionProvider } from '../../shared/operational-access/operational-session-provider';
import { PosOperationalSessionProvider } from '../../features/sell/session/pos-operational-session-provider';

function runtimeLocale(locale: string): OperationalLocale {
  return locale === 'en-US' ? 'en-US' : 'id-ID';
}

const queryClient = new QueryClient({
  defaultOptions: operationalQueryClientDefaults,
});

interface OperationalProvidersProps {
  bootstrap: DeploymentBootstrapConfig;
  session: AuthSession | null;
  authPort: AuthPort;
  router: RouterProviderProps['router'];
}

type OperationalAuthBoundaryProps = Omit<OperationalProvidersProps, 'bootstrap'>;

function OperationalAuthBoundary({ session, authPort, router }: OperationalAuthBoundaryProps) {
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

  useEffect(() => {
    if (!isLoggingOut) return undefined;
    // Return to sign-in even when the exit transition end is not delivered.
    const timer = window.setTimeout(() => {
      setAuthenticatedSession(null);
      setLoggingOut(false);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [isLoggingOut]);

  const completeLogoutTransition = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!isLoggingOut) return;
    setAuthenticatedSession(null);
    setLoggingOut(false);
  };

  if (!authenticatedSession) {
    return <OperationalLoginPage authPort={authPort} onAuthenticated={handleAuthenticated} />;
  }

  const surface = resolveOperationalSurfaceAccess(authenticatedSession.access);
  const operationalEnabled = authenticatedSession.access.foundations.includes('OPERATIONAL_ACCESS');
  const denial = !operationalEnabled ? 'MODULE_NOT_ENABLED' : surface.denial;

  if (denial || !surface.home) {
    return (
      <OperationalAccessDenied
        reason={denial ?? 'NO_PERMITTED_MODULE'}
        copy={copy}
        onChangeAccount={() => {
          sessionEnded.current = true;
          void authPort.logout().finally(() => setAuthenticatedSession(null));
        }}
        onCheckAgain={async () => {
          const refreshed = await authPort.refreshSessionContext();
          if (!refreshed) {
            setAuthenticatedSession(null);
            return true;
          }
          const next = resolveOperationalSurfaceAccess(refreshed.access);
          const enabled = refreshed.access.foundations.includes('OPERATIONAL_ACCESS');
          if (enabled && next.home) {
            setAuthenticatedSession(refreshed);
            return true;
          }
          return false;
        }}
      />
    );
  }

  return (
    <AuthenticatedRuntimeProjectionProvider projection={authenticatedSession}>
      <AuthProvider
        session={authenticatedSession}
        authPort={authPort}
        onLogout={() => setLoggingOut(true)}
      >
        <DLocalizationProvider locale={runtimeLocale(authenticatedSession.preferences.locale)}>
          <OperationalSessionProvider>
            <PosOperationalSessionProvider>
              <div
                className={`operational-view-enter min-h-screen transition-[opacity,transform] duration-150 ease-out ${
                  isLoggingOut ? 'pointer-events-none -translate-y-1 opacity-0' : 'opacity-100'
                }`}
                onTransitionEnd={completeLogoutTransition}
              >
                <ConnectedOperationalRouter router={router} />
              </div>
            </PosOperationalSessionProvider>
          </OperationalSessionProvider>
        </DLocalizationProvider>
      </AuthProvider>
    </AuthenticatedRuntimeProjectionProvider>
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
              <OperationalAuthBoundary session={session} authPort={authPort} router={router} />
            </ToastProvider>
          </DLocalizationProvider>
        </QueryClientProvider>
      </ConnectivityProvider>
    </DeploymentBootstrapProvider>
  );
}

function ConnectedOperationalRouter({ router }: Pick<OperationalProvidersProps, 'router'>) {
  const { isOnline } = useConnectivity();
  return (
    <ConnectionStateBoundary isOnline={isOnline}>
      <RouterProvider router={router} />
    </ConnectionStateBoundary>
  );
}
