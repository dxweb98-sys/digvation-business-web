import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { AuthPort, AuthSession, LegacyCompatibleAuthSession } from './auth.types';
import { withLegacySessionAliases } from './session-compat';

interface AuthContextValue {
  session: LegacyCompatibleAuthSession;
  authPort: AuthPort;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  session: AuthSession;
  authPort: AuthPort;
  children: ReactNode;
  onLogout?: () => void;
}

export function AuthProvider({ session, authPort, children, onLogout }: AuthProviderProps) {
  const logout = useCallback(async () => {
    const revocation = authPort.logout();
    onLogout?.();
    await revocation;
  }, [authPort, onLogout]);
  const compatibleSession = useMemo(() => withLegacySessionAliases(session), [session]);
  const value = useMemo(
    () => ({ session: compatibleSession, authPort, logout }),
    [authPort, compatibleSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const context = useOptionalAuth();

  if (!context) {
    throw new Error('AuthProvider is missing.');
  }

  return context;
}
