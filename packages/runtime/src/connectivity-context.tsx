import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ConnectivityState = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

interface ConnectivityContextValue {
  state: ConnectivityState;
  isOnline: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

function readConnectivityState(): ConnectivityState {
  if (typeof navigator === 'undefined') return 'ONLINE';
  return navigator.onLine ? 'ONLINE' : 'OFFLINE';
}

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectivityState>(readConnectivityState);

  useEffect(() => {
    const handleOnline = () => setState('ONLINE');
    const handleOffline = () => setState('OFFLINE');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value = useMemo(() => ({ state, isOnline: state !== 'OFFLINE' }), [state]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityContextValue {
  const value = useContext(ConnectivityContext);

  if (!value) {
    throw new Error('ConnectivityProvider is missing.');
  }

  return value;
}
