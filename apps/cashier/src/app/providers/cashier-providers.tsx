import { AuthProvider, type AuthPort, type AuthSession } from '@digvation/pos-auth';
import { ConnectivityProvider, RuntimeProvider, type RuntimeConfig } from '@digvation/pos-runtime';
import { DToastProvider as ToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { useState, type TransitionEvent } from 'react';

import { CashierLoginPage } from '../auth/cashier-login-page';
import { CashierSessionProvider } from './cashier-session-provider';

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

interface CashierProvidersProps {
  runtime: RuntimeConfig;
  session: AuthSession | null;
  authPort: AuthPort;
  router: RouterProviderProps['router'];
}

export function CashierProviders({ runtime, session, authPort, router }: CashierProvidersProps) {
  const [authenticatedSession, setAuthenticatedSession] = useState(session);
  const [isLoggingOut, setLoggingOut] = useState(false);

  const completeLogoutTransition = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!isLoggingOut) return;
    setAuthenticatedSession(null);
    setLoggingOut(false);
  };

  return (
    <RuntimeProvider config={runtime}>
      <ConnectivityProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            {authenticatedSession ? (
              <AuthProvider
                session={authenticatedSession}
                authPort={authPort}
                onLogout={() => setLoggingOut(true)}
              >
                <CashierSessionProvider>
                  <div
                    className={`min-h-screen transition-[opacity,transform] duration-150 ease-out ${
                      isLoggingOut ? 'pointer-events-none -translate-y-1 opacity-0' : 'opacity-100'
                    }`}
                    onTransitionEnd={completeLogoutTransition}
                  >
                    <RouterProvider router={router} />
                  </div>
                </CashierSessionProvider>
              </AuthProvider>
            ) : (
              <CashierLoginPage authPort={authPort} onAuthenticated={setAuthenticatedSession} />
            )}
          </ToastProvider>
        </QueryClientProvider>
      </ConnectivityProvider>
    </RuntimeProvider>
  );
}
