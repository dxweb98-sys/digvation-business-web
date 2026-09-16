import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import type { AuthPort } from '@digvation/business-auth';
import { DLocalizationProvider, DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { AuthenticationLoading } from '../../auth/authentication-loading';
import { BackofficeAuthProvider, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { resolveBackofficeLocale } from '../localization/backoffice-locale';
import {
  BackofficeLocalizationProvider,
  useBackofficeLocalization,
} from '../localization/backoffice-localization.legacy';
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
  router: RouterProviderProps['router'];
}

export function BackofficeProviders({ bootstrap, auth, router }: BackofficeProvidersProps) {
  return (
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <BackofficeDesignSystemProviders auth={auth} router={router} />
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>
  );
}

function BackofficeDesignSystemProviders({
  auth,
  router,
}: Omit<BackofficeProvidersProps, 'bootstrap'>) {
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

  useEffect(() => {
    if (!session) return;
    setLocale(resolveBackofficeLocale(session.preferences.locale));
  }, [session, setLocale]);

  if (status === 'hydrating') return <AuthenticationLoading />;

  return (
    <QueryClientProvider client={queryClient}>
      <BusinessLocationProvider>
        <RouterProvider router={router} />
      </BusinessLocationProvider>
    </QueryClientProvider>
  );
}
