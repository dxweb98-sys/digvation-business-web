import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { AuthPort, AuthSession } from './auth.types';

interface AuthContextValue {
  session: AuthSession;
  authPort: AuthPort;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends Omit<AuthContextValue, 'logout'> {
  children: ReactNode;
  onLogout?: () => void;
}

export function AuthProvider({ session, authPort, children, onLogout }: AuthProviderProps) {
  const logout = useCallback(async () => {
    await authPort.logout();
    onLogout?.();
  }, [authPort, onLogout]);
  const value = useMemo(() => ({ session, authPort, logout }), [authPort, logout, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('AuthProvider is missing.');
  }

  return context;
}
