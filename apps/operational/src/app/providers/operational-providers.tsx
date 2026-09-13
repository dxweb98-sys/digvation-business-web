import { AuthProvider, useAuth, type AuthPort, type AuthSession } from '@digvation/business-auth';
import {
  applyEffectiveBusinessConfiguration,
  ConnectivityProvider,
  loadAuthenticatedRuntimeAvailability,
  RuntimeProvider,
  useRuntime,
  type RuntimeConfig,
} from '@digvation/business-runtime';
import { DToastProvider as ToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { useEffect, useState, type ReactNode, type TransitionEvent } from 'react';

import { OperationalLoginPage } from '../../modules/operational/operational-login-page';
import { OperationalSessionProvider } from '../../modules/operational/operational-session-provider';
import { PosOperationalSessionProvider } from '../../modules/pos/pos-operational-session-provider';

function AuthenticatedOperationalRuntime({ children }: { children: ReactNode }) {
  const { session, authPort } = useAuth();
  const bootstrapRuntime = useRuntime();
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'unavailable'>('loading');
  const [effectiveRuntime, setEffectiveRuntime] = useState<RuntimeConfig | null>(null);

  useEffect(() => {
    let active = true;
    setState('loading');
    setEffectiveRuntime(null);
    void (async () => {
      const token = await authPort.getAccessToken?.();
      if (!token) {
        if (active) setState('denied');
        return;
      }
      try {
        const availability = await loadAuthenticatedRuntimeAvailability(
          bootstrapRuntime.apiBaseUrl,
          token,
        );
        if (!active) return;
        if (!availability.effectiveEntitlements.products.includes('POS')) {
          setState('denied');
          return;
        }
        setEffectiveRuntime(
          applyEffectiveBusinessConfiguration(
            bootstrapRuntime,
            availability.businessConfiguration,
          ),
        );
        setState('allowed');
      } catch {
        if (active) setState('unavailable');
      }
    })();
    return () => {
      active = false;
    };
  }, [authPort, bootstrapRuntime, session.identity.userId]);

  if (state === 'allowed' && effectiveRuntime)
    return <RuntimeProvider config={effectiveRuntime}>{children}</RuntimeProvider>;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
      <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-lg font-semibold">
          {state === 'loading'
            ? 'Memverifikasi akses operasional'
            : state === 'denied'
              ? 'Akses POS tidak tersedia'
              : 'Konteks operasional belum tersedia'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {state === 'loading'
            ? 'Mohon tunggu.'
            : 'Hubungi administrator jika akses ini seharusnya tersedia.'}
        </p>
      </section>
    </main>
  );
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
  runtime: RuntimeConfig;
  session: AuthSession | null;
  authPort: AuthPort;
  router: RouterProviderProps['router'];
}

export function OperationalProviders({
  runtime,
  session,
  authPort,
  router,
}: OperationalProvidersProps) {
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
                <AuthenticatedOperationalRuntime>
                  <OperationalSessionProvider>
                    <PosOperationalSessionProvider>
                      <div
                        className={`min-h-screen transition-[opacity,transform] duration-150 ease-out ${
                          isLoggingOut
                            ? 'pointer-events-none -translate-y-1 opacity-0'
                            : 'opacity-100'
                        }`}
                        onTransitionEnd={completeLogoutTransition}
                      >
                        <RouterProvider router={router} />
                      </div>
                    </PosOperationalSessionProvider>
                  </OperationalSessionProvider>
                </AuthenticatedOperationalRuntime>
              </AuthProvider>
            ) : (
              <OperationalLoginPage authPort={authPort} onAuthenticated={setAuthenticatedSession} />
            )}
          </ToastProvider>
        </QueryClientProvider>
      </ConnectivityProvider>
    </RuntimeProvider>
  );
}
