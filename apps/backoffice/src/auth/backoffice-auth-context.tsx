import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthLoginInput,
  AuthPort,
  LegacyCompatibleAuthSession,
  SessionEndReason,
} from '@digvation/business-auth';
import { withLegacySessionAliases } from '@digvation/business-auth';
import { useToast } from '@digvation/ui';
import { ApiClient } from '@digvation/business-api';

import {
  isBackofficeSessionExpired,
  normalizeBackofficeApiError,
} from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization-base';

type AuthenticationStatus =
  | 'hydrating'
  | 'authenticated'
  | 'unauthenticated'
  | 'unavailable';

interface BackofficeAuthContextValue {
  status: AuthenticationStatus;
  session: LegacyCompatibleAuthSession | null;
  login(input: AuthLoginInput): Promise<void>;
  logout(): Promise<void>;
  refreshSessionContext(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  createApiClient(baseUrl: string): ApiClient;
}

const BackofficeAuthContext = createContext<BackofficeAuthContextValue | null>(null);
const BUSINESS_CONFIGURATION_CHANGED_EVENT = 'digvation:business-configuration-changed';

export function BackofficeAuthProvider({
  auth,
  children,
}: {
  auth: AuthPort;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<AuthenticationStatus>('hydrating');
  const [session, setSession] = useState<LegacyCompatibleAuthSession | null>(null);
  const { showToast } = useToast();
  const { t } = useBackofficeLocalization();
  const sessionExpired = useRef(false);

  const expireSession = useCallback(
    (_reason: SessionEndReason) => {
      if (sessionExpired.current) return;
      sessionExpired.current = true;
      setSession(null);
      setStatus('unauthenticated');
      showToast({ variant: 'warning', title: t('sessionExpired') });
      void auth.logout();
    },
    [auth, showToast, t],
  );

  useEffect(
    () => auth.subscribeSessionEnded?.(expireSession),
    [auth, expireSession],
  );

  useEffect(() => {
    let isMounted = true;
    void auth.me().then(
      (restored) => {
        if (!isMounted || sessionExpired.current) return;
        setSession(restored ? withLegacySessionAliases(restored) : null);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      },
      (error: unknown) => {
        if (!isMounted || sessionExpired.current) return;
        setSession(null);
        const normalized = normalizeBackofficeApiError(error);
        if (normalized.code === 'BACKOFFICE_ACCESS_DENIED') {
          setStatus('unauthenticated');
          showToast({ variant: 'warning', title: normalized.safeMessage });
          void auth.logout();
          return;
        }
        setStatus('unavailable');
      },
    );
    return () => {
      isMounted = false;
    };
  }, [auth, showToast]);

  const login = useCallback(
    async (input: AuthLoginInput) => {
      const authenticated = await auth.login(input);
      sessionExpired.current = false;
      setSession(withLegacySessionAliases(authenticated));
      setStatus('authenticated');
    },
    [auth],
  );

  const logout = useCallback(async () => {
    sessionExpired.current = false;
    const revocation = auth.logout();
    setSession(null);
    setStatus('unauthenticated');
    showToast({ variant: 'success', title: t('signedOut') });
    await revocation;
  }, [auth, showToast, t]);

  const refreshSessionContext = useCallback(async () => {
    try {
      const refreshed = await auth.refreshSessionContext();
      if (!refreshed) {
        setSession(null);
        setStatus('unauthenticated');
        return;
      }
      sessionExpired.current = false;
      setSession(withLegacySessionAliases(refreshed));
      setStatus('authenticated');
    } catch {
      setStatus('unavailable');
    }
  }, [auth]);

  useEffect(() => {
    const handleConfigurationChanged = () => {
      void refreshSessionContext();
    };
    window.addEventListener(BUSINESS_CONFIGURATION_CHANGED_EVENT, handleConfigurationChanged);
    return () =>
      window.removeEventListener(BUSINESS_CONFIGURATION_CHANGED_EVENT, handleConfigurationChanged);
  }, [refreshSessionContext]);

  const getAccessToken = useCallback(
    () => auth.getAccessToken?.() ?? Promise.resolve(null),
    [auth],
  );
  const refreshAccessToken = useCallback(
    () =>
      auth.refreshAccessToken?.() ??
      Promise.resolve({ kind: 'ended' as const, reason: 'invalid' as const }),
    [auth],
  );
  const createApiClient = useCallback(
    (baseUrl: string) =>
      new ApiClient({
        baseUrl,
        applicationSurface: 'backoffice',
        getAccessToken,
        refreshAccessToken,
        onSessionEnded: expireSession,
      }),
    [expireSession, getAccessToken, refreshAccessToken],
  );

  const value = useMemo(
    () => ({
      status,
      session,
      login,
      logout,
      refreshSessionContext,
      getAccessToken,
      createApiClient,
    }),
    [
      createApiClient,
      getAccessToken,
      login,
      logout,
      refreshSessionContext,
      session,
      status,
    ],
  );
  return (
    <BackofficeAuthContext.Provider value={value}>
      {children}
    </BackofficeAuthContext.Provider>
  );
}

export function useBackofficeAuth(): BackofficeAuthContextValue {
  const context = useContext(BackofficeAuthContext);
  if (!context) throw new Error('BackofficeAuthProvider is missing.');
  return context;
}

export function isSessionExpiredError(error: unknown): boolean {
  return isBackofficeSessionExpired(error);
}
