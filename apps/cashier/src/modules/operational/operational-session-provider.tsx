import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface OperationalSessionContextValue {
  selectedLocationId: string | null;
  isBranchPickerOpen: boolean;
  selectLocation: (locationId: string | null) => void;
  openBranchPicker: () => void;
  closeBranchPicker: () => void;
}

const OperationalSessionContext = createContext<OperationalSessionContextValue | null>(null);

export function OperationalSessionProvider({ children }: { children: ReactNode }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [isBranchPickerOpen, setBranchPickerOpen] = useState(false);

  const selectLocation = useCallback((locationId: string | null) => {
    setSelectedLocationId(locationId);
  }, []);

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
