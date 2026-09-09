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
import { useToast } from '@digvation/ui';
import { ApiClient } from '@digvation/business-api';

import { isBackofficeSessionExpired } from '../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import type { BackofficeSession, LoginCredentials } from './auth-session';
import type { HttpAuthAdapter } from './http-auth-adapter';

type AuthenticationStatus = 'hydrating' | 'authenticated' | 'unauthenticated';

interface BackofficeAuthContextValue {
  status: AuthenticationStatus;
  session: BackofficeSession | null;
  login(input: LoginCredentials): Promise<void>;
  logout(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  createApiClient(baseUrl: string): ApiClient;
}

const BackofficeAuthContext = createContext<BackofficeAuthContextValue | null>(null);

export function BackofficeAuthProvider({
  auth,
  children,
}: {
  auth: HttpAuthAdapter;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<AuthenticationStatus>('hydrating');
  const [session, setSession] = useState<BackofficeSession | null>(null);
  const { showToast } = useToast();
  const { t } = useBackofficeLocalization();
  const sessionExpired = useRef(false);

  useEffect(() => {
    let isMounted = true;
    void auth.restore().then(
      (restored) => {
        if (!isMounted) return;
        setSession(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      },
      () => {
        if (!isMounted) return;
        setSession(null);
        setStatus('unauthenticated');
      },
    );
    return () => {
      isMounted = false;
    };
  }, [auth]);

  const login = useCallback(
    async (input: LoginCredentials) => {
      const authenticated = await auth.login(input);
      sessionExpired.current = false;
      setSession(authenticated);
      setStatus('authenticated');
    },
    [auth],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setSession(null);
    setStatus('unauthenticated');
    showToast({ variant: 'success', title: t('signedOut') });
  }, [auth, showToast, t]);

  const getAccessToken = useCallback(() => auth.getAccessToken(), [auth]);
  const expireSession = useCallback(() => {
    if (sessionExpired.current) return;
    sessionExpired.current = true;
    setSession(null);
    setStatus('unauthenticated');
    showToast({ variant: 'warning', title: t('sessionExpired') });
    void auth.logout();
  }, [auth, showToast, t]);
  const createApiClient = useCallback(
    (baseUrl: string) => new ApiClient({ baseUrl, getAccessToken, onUnauthorized: expireSession }),
    [expireSession, getAccessToken],
  );

  const value = useMemo(
    () => ({ status, session, login, logout, getAccessToken, createApiClient }),
    [createApiClient, getAccessToken, login, logout, session, status],
  );
  return <BackofficeAuthContext.Provider value={value}>{children}</BackofficeAuthContext.Provider>;
}

export function useBackofficeAuth(): BackofficeAuthContextValue {
  const context = useContext(BackofficeAuthContext);
  if (!context) throw new Error('BackofficeAuthProvider is missing.');
  return context;
}

export function isSessionExpiredError(error: unknown): boolean {
  return isBackofficeSessionExpired(error);
}
