import {
  AuthProvider,
  useAuth,
  type AuthPort,
  type AuthSession,
} from '@digvation/business-auth';
import {
  ApplicationSplash,
  applyEffectiveBusinessConfiguration,
  ConnectivityProvider,
  loadAuthenticatedRuntimeAvailability,
  RuntimeProvider,
  useRuntime,
  type RuntimeAvailabilityConfig,
  type RuntimeConfig,
} from '@digvation/business-runtime';
import {
  DLocalizationProvider,
  DToastProvider as ToastProvider,
  useToast,
} from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RouterProviderProps } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from 'react';

import {
  operationalCopy,
  type OperationalLocale,
} from '../localization/operational-localization';
import { OperationalLoginPage } from '../../modules/operational/operational-login-page';
import { OperationalSessionProvider } from '../../modules/operational/operational-session-provider';
import { PosOperationalSessionProvider } from '../../modules/pos/pos-operational-session-provider';
import { OperationalAvailabilityProvider } from './operational-availability-context';

function runtimeLocale(locale: string): OperationalLocale {
  return locale === 'en-US' ? 'en-US' : 'id-ID';
}

function hasImplementedOperationalSurface(availability: RuntimeAvailabilityConfig): boolean {
  const permissions = availability.effectivePermissions;
  const hasPos =
    availability.effectiveEntitlements.products.includes('POS') &&
    permissions.some((permission) => permission.startsWith('sales:'));
  const hasExpenses =
    availability.effectiveEntitlements.capabilities.includes('FINANCE_OPERATIONS') &&
    permissions.some((permission) => permission.startsWith('expenses:'));
  return hasPos || hasExpenses;
}

function AuthenticatedOperationalRuntime({ children }: { children: ReactNode }) {
  const { session, authPort } = useAuth();
  const bootstrapRuntime = useRuntime();
  const locale = runtimeLocale(bootstrapRuntime.locale);
  const copy = (value: string) => operationalCopy(value, locale);
  const [state, setState] = useState<'loading' | 'allowed' | 'denied' | 'unavailable'>(
    'loading',
  );
  const [effectiveRuntime, setEffectiveRuntime] = useState<RuntimeConfig | null>(null);
  const [availability, setAvailability] = useState<RuntimeAvailabilityConfig | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const token = await authPort.getAccessToken?.();
      if (!token) {
        if (active) setState('denied');
        return;
      }
      try {
        const nextAvailability = await loadAuthenticatedRuntimeAvailability(
          bootstrapRuntime.apiBaseUrl,
          token,
        );
        if (!active) return;
        if (
          !nextAvailability.effectiveFoundations.includes('OPERATIONAL_ACCESS') ||
          !hasImplementedOperationalSurface(nextAvailability)
        ) {
          setState('denied');
          return;
        }
        setAvailability(nextAvailability);
        setEffectiveRuntime(
          applyEffectiveBusinessConfiguration(
            bootstrapRuntime,
            nextAvailability.businessConfiguration,
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

  if (state === 'allowed' && effectiveRuntime && availability)
    return (
      <RuntimeProvider config={effectiveRuntime}>
        <OperationalAvailabilityProvider availability={availability}>
          <DLocalizationProvider locale={runtimeLocale(effectiveRuntime.locale)}>
            {children}
          </DLocalizationProvider>
        </OperationalAvailabilityProvider>
      </RuntimeProvider>
    );

  if (state === 'loading')
    return (
      <ApplicationSplash
        productName={bootstrapRuntime.branding.productName}
        message={locale === 'id-ID' ? 'Memuat Operasional...' : 'Loading Operational...'}
      />
    );

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
      <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-lg font-semibold">
          {state === 'denied'
            ? copy('Operational access unavailable')
            : copy('Operational context unavailable')}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {copy('Contact an administrator if this access should be available.')}
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

type OperationalAuthBoundaryProps = OperationalProvidersProps;

function OperationalAuthBoundary({
  runtime,
  session,
  authPort,
  router,
}: OperationalAuthBoundaryProps) {
  const locale = runtimeLocale(runtime.locale);
  const copy = useCallback(
    (value: string) => operationalCopy(value, locale),
    [locale],
  );
  const [authenticatedSession, setAuthenticatedSession] = useState(session);
  const [isLoggingOut, setLoggingOut] = useState(false);
  const sessionEnded = useRef(false);
  const { showToast } = useToast();

  const handleSessionEnded = useCallback(() => {
    if (sessionEnded.current) return;
    sessionEnded.current = true;
    setLoggingOut(false);
    setAuthenticatedSession(null);
    showToast({
      variant: 'warning',
      title: copy('Your session has ended. Sign in again.'),
    });
    void authPort.logout();
  }, [authPort, copy, showToast]);

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

  return (
    <AuthProvider
      session={authenticatedSession}
      authPort={authPort}
      onLogout={() => setLoggingOut(true)}
    >
      <AuthenticatedOperationalRuntime
        key={`${authenticatedSession.identity.userId}:${runtime.apiBaseUrl}`}
      >
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
      </AuthenticatedOperationalRuntime>
    </AuthProvider>
  );
}

export function OperationalProviders({
  runtime,
  session,
  authPort,
  router,
}: OperationalProvidersProps) {
  return (
    <RuntimeProvider config={runtime}>
      <ConnectivityProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <OperationalAuthBoundary
              runtime={runtime}
              session={session}
              authPort={authPort}
              router={router}
            />
          </ToastProvider>
        </QueryClientProvider>
      </ConnectivityProvider>
    </RuntimeProvider>
  );
}
