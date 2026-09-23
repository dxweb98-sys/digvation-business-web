import {
  AuthenticatedRuntimeProjectionProvider,
  ConnectivityProvider,
  DeploymentBootstrapProvider,
  useConnectivity,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { ConnectionStateBoundary } from '@digvation/business-system-states';
import type { AuthPort } from '@digvation/business-auth';
import { DLocalizationProvider, DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { BackofficeAuthProvider, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { PasswordRecoveryProvider, type PasswordRecoveryPort } from '../../auth/password-recovery';
import { useBackofficeStartupReady } from '../bootstrap/backoffice-startup';
import { resolveBackofficeLocale } from '../localization/backoffice-locale';
import {
  BackofficeLocalizationProvider,
  useBackofficeLocalization,
} from '../localization/backoffice-localization-base';
import { BusinessLocationProvider } from './business-location-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

interface BackofficeProvidersProps {
  bootstrap: DeploymentBootstrapConfig;
  auth: AuthPort;
  passwordRecovery: PasswordRecoveryPort;
  router: RouterProviderProps['router'];
}

export function BackofficeProviders({
  bootstrap,
  auth,
  passwordRecovery,
  router,
}: BackofficeProvidersProps) {
  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <ConnectivityProvider>
        <BackofficeLocalizationProvider>
          <PasswordRecoveryProvider port={passwordRecovery}>
            <BackofficeDesignSystemProviders auth={auth} router={router} />
          </PasswordRecoveryProvider>
        </BackofficeLocalizationProvider>
      </ConnectivityProvider>
    </DeploymentBootstrapProvider>
  );
}

function BackofficeDesignSystemProviders({
  auth,
  router,
}: Pick<BackofficeProvidersProps, 'auth' | 'router'>) {
  const { locale } = useBackofficeLocalization();

  return (
    <DLocalizationProvider locale={locale === 'id' ? 'id-ID' : 'en-US'}>
      <DToastProvider>
        <BackofficeAuthProvider auth={auth}>
          <AuthenticatedBackofficeProviders router={router} />
        </BackofficeAuthProvider>
      </DToastProvider>
    </DLocalizationProvider>
  );
}

function AuthenticatedBackofficeProviders({ router }: Pick<BackofficeProvidersProps, 'router'>) {
  const { session, status } = useBackofficeAuth();
  const { setLocale } = useBackofficeLocalization();
  const markStartupReady = useBackofficeStartupReady();

  useEffect(() => {
    if (!session) return;
    setLocale(resolveBackofficeLocale(session.preferences.locale));
  }, [session, setLocale]);

  useEffect(() => {
    if (status !== 'hydrating') markStartupReady();
  }, [markStartupReady, status]);

  // The startup splash overlay stays visible until session restore settles.
  if (status === 'hydrating') return null;

  const content = (
    <QueryClientProvider client={queryClient}>
      <BusinessLocationProvider>
        <ConnectedBackofficeRouter router={router} />
      </BusinessLocationProvider>
    </QueryClientProvider>
  );

  if (!session) return content;

  return (
    <AuthenticatedRuntimeProjectionProvider projection={session}>
      {content}
    </AuthenticatedRuntimeProjectionProvider>
  );
}

function ConnectedBackofficeRouter({ router }: Pick<BackofficeProvidersProps, 'router'>) {
  const { isOnline } = useConnectivity();
  return (
    <ConnectionStateBoundary isOnline={isOnline}>
      <RouterProvider router={router} />
    </ConnectionStateBoundary>
  );
}
