import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface PosOperationalSessionContextValue {
  recentSaleIds: readonly string[];
  rememberSale: (saleId: string) => void;
}

const PosOperationalSessionContext = createContext<PosOperationalSessionContextValue | null>(null);
const MAX_RECENT_SALES = 8;

export function PosOperationalSessionProvider({ children }: { children: ReactNode }) {
  const [recentSaleIds, setRecentSaleIds] = useState<readonly string[]>([]);

  const rememberSale = useCallback((saleId: string) => {
    setRecentSaleIds((current) =>
      [saleId, ...current.filter((currentSaleId) => currentSaleId !== saleId)].slice(
        0,
        MAX_RECENT_SALES,
      ),
    );
  }, []);

  const value = useMemo(() => ({ recentSaleIds, rememberSale }), [recentSaleIds, rememberSale]);

  return (
    <PosOperationalSessionContext.Provider value={value}>
      {children}
    </PosOperationalSessionContext.Provider>
  );
}

export function usePosOperationalSession(): PosOperationalSessionContextValue {
  const value = useContext(PosOperationalSessionContext);

  if (!value) {
    throw new Error('PosOperationalSessionProvider is missing.');
  }

  return value;
}
