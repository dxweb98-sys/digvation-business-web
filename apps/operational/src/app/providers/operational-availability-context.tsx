import type { RuntimeAvailabilityConfig } from '@digvation/business-runtime';
import { createContext, useContext, type ReactNode } from 'react';

const OperationalAvailabilityContext = createContext<RuntimeAvailabilityConfig | null>(null);

export function OperationalAvailabilityProvider({
  availability,
  children,
}: {
  availability: RuntimeAvailabilityConfig;
  children: ReactNode;
}) {
  return (
    <OperationalAvailabilityContext.Provider value={availability}>
      {children}
    </OperationalAvailabilityContext.Provider>
  );
}

export function useOperationalAvailability(): RuntimeAvailabilityConfig {
  const value = useContext(OperationalAvailabilityContext);
  if (!value) throw new Error('OperationalAvailabilityProvider is missing.');
  return value;
}

export function hasOperationalPermission(
  availability: RuntimeAvailabilityConfig,
  permission: string,
): boolean {
  return availability.effectivePermissions.includes(permission);
}
