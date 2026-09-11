import { RuntimeProvider, type RuntimeConfig } from '@digvation/business-runtime';
import { DLocalizationProvider, DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { BackofficeAuthProvider } from '../../auth/backoffice-auth-context';
import type { HttpAuthAdapter } from '../../auth/http-auth-adapter';
import { BackofficeLocalizationProvider, useBackofficeLocalization } from '../localization/backoffice-localization';
import { BusinessLocationProvider } from './business-location-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

interface BackofficeProvidersProps {
  runtime: RuntimeConfig;
  auth: HttpAuthAdapter;
  router: RouterProviderProps['router'];
}

export function BackofficeProviders({ runtime, auth, router }: BackofficeProvidersProps) {
  return (
    <RuntimeProvider config={runtime}>
      <BackofficeLocalizationProvider>
        <BackofficeDesignSystemProviders auth={auth} router={router} />
      </BackofficeLocalizationProvider>
    </RuntimeProvider>
  );
}

function BackofficeDesignSystemProviders({ auth, router }: Omit<BackofficeProvidersProps, 'runtime'>) {
  const { locale } = useBackofficeLocalization();

  return (
    <DLocalizationProvider locale={locale === 'id' ? 'id-ID' : 'en-US'}>
      <DToastProvider>
        <BackofficeAuthProvider auth={auth}>
          <QueryClientProvider client={queryClient}>
            <BusinessLocationProvider>
              <RouterProvider router={router} />
            </BusinessLocationProvider>
          </QueryClientProvider>
        </BackofficeAuthProvider>
      </DToastProvider>
    </DLocalizationProvider>
  );
}
