import { useAuth } from '@digvation/business-auth';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface OperationalSessionContextValue {
  selectedLocationId: string | null;
  isBranchPickerOpen: boolean;
  selectLocation: (locationId: string | null) => void;
  openBranchPicker: () => void;
  closeBranchPicker: () => void;
}

const OperationalSessionContext = createContext<OperationalSessionContextValue | null>(null);

function storageKey(tenantId: string, userId: string) {
  return `digvation.operational.location.v1:${tenantId}:${userId}`;
}

function readStoredLocation(tenantId: string, userId: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(tenantId, userId));
  } catch {
    return null;
  }
}

export function OperationalSessionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const tenantId = session.business.tenantId;
  const userId = session.identity.userId;
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() =>
    readStoredLocation(tenantId, userId),
  );
  const [isBranchPickerOpen, setBranchPickerOpen] = useState(false);

  const selectLocation = useCallback(
    (locationId: string | null) => {
      setSelectedLocationId(locationId);
      try {
        if (locationId) window.sessionStorage.setItem(storageKey(tenantId, userId), locationId);
        else window.sessionStorage.removeItem(storageKey(tenantId, userId));
      } catch {
        // Selection persistence is convenience state only. Runtime authorization remains authoritative.
      }
    },
    [tenantId, userId],
  );

  const openBranchPicker = useCallback(() => {
    setBranchPickerOpen(true);
  }, []);

  const closeBranchPicker = useCallback(() => {
    setBranchPickerOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      selectedLocationId,
      isBranchPickerOpen,
      selectLocation,
      openBranchPicker,
      closeBranchPicker,
    }),
    [closeBranchPicker, isBranchPickerOpen, openBranchPicker, selectLocation, selectedLocationId],
  );

  return (
    <OperationalSessionContext.Provider value={value}>
      {children}
    </OperationalSessionContext.Provider>
  );
}

export function useOperationalSession(): OperationalSessionContextValue {
  const value = useContext(OperationalSessionContext);

  if (!value) {
    throw new Error('OperationalSessionProvider is missing.');
  }

  return value;
}
