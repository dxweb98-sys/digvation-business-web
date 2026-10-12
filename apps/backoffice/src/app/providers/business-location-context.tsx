import { hasSessionFeature } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useBackofficeAuth } from '../../auth/backoffice-auth-context';

export interface BackofficeLocationOption {
  id: string;
  code: string;
  name?: string;
  displayName?: string;
}

interface OperationalAccess {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
  mainLocationId: string | null;
  locations: BackofficeLocationOption[];
}

interface BusinessLocationContextValue {
  locations: readonly BackofficeLocationOption[];
  selectedLocationId: string;
  mainLocationId: string | null;
  isReady: boolean;
  isDenied: boolean;
  selectLocation(locationId: string): void;
}

const BusinessLocationContext = createContext<BusinessLocationContextValue | null>(null);

function readPreference(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function clearPreference(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Location preference is never an authorization source.
  }
}

function writePreference(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Branch selection is convenience state only.
  }
}

export function BusinessLocationProvider({ children }: { children: ReactNode }) {
  const bootstrap = useDeploymentBootstrap();
  const { session, createApiClient } = useBackofficeAuth();
  const api = useMemo(
    () => createApiClient(bootstrap.apiBaseUrl),
    [bootstrap.apiBaseUrl, createApiClient],
  );
  // The self-scoped context endpoint requires auth:self, not permission to
  // administer other users' assignments.
  const canReadOperationalAccess = Boolean(session);
  const canSwitchBranches = Boolean(session && hasSessionFeature(session.access, 'MULTI_BRANCH'));
  const preferenceKey = session
    ? `digvation.backoffice.dashboard.location.v1:${session.business.tenantId}:${session.identity.userId}`
    : 'digvation.backoffice.dashboard.location.v1:anonymous';
  const [preferredLocationId, setPreferredLocationId] = useState<string | null>(() =>
    readPreference(preferenceKey),
  );

  const query = useQuery({
    queryKey: [
      'operational-location-context',
      session?.business.tenantId,
      session?.identity.userId,
      session?.contextVersion,
    ],
    queryFn: () => api.get<OperationalAccess>('/api/v1/operational-access/context'),
    enabled: canReadOperationalAccess,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const locations = useMemo(() => {
    if (!canReadOperationalAccess) return [];
    const all = [...(query.data?.locations ?? [])];
    all.sort((left, right) => {
      if (left.id === query.data?.mainLocationId) return -1;
      if (right.id === query.data?.mainLocationId) return 1;
      return (left.name ?? left.displayName ?? left.code).localeCompare(
        right.name ?? right.displayName ?? right.code,
      );
    });
    if (canSwitchBranches) return all;
    const main = all.find((location) => location.id === query.data?.mainLocationId);
    return main ? [main] : [];
  }, [
    canReadOperationalAccess,
    canSwitchBranches,
    query.data?.locations,
    query.data?.mainLocationId,
  ]);

  const accessibleIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations],
  );
  const preferredIsValid = Boolean(preferredLocationId && accessibleIds.has(preferredLocationId));
  useEffect(() => {
    if (query.data && preferredLocationId && !preferredIsValid) {
      setPreferredLocationId(null);
      clearPreference(preferenceKey);
    }
  }, [preferenceKey, preferredIsValid, preferredLocationId, query.data]);
  const fallbackLocationId =
    query.data?.mainLocationId && accessibleIds.has(query.data.mainLocationId)
      ? query.data.mainLocationId
      : (locations[0]?.id ?? '');
  const selectedLocationId = preferredIsValid ? (preferredLocationId ?? '') : fallbackLocationId;
  const isDenied = canReadOperationalAccess && Boolean(query.data) && locations.length === 0;
  const isReady = Boolean(
    canReadOperationalAccess &&
    query.data &&
    !isDenied &&
    selectedLocationId &&
    accessibleIds.has(selectedLocationId),
  );

  const value = useMemo<BusinessLocationContextValue>(
    () => ({
      locations,
      selectedLocationId,
      mainLocationId: canReadOperationalAccess ? (query.data?.mainLocationId ?? null) : null,
      isReady,
      isDenied,
      selectLocation(locationId: string) {
        if (!canReadOperationalAccess || !accessibleIds.has(locationId)) return;
        setPreferredLocationId(locationId);
        writePreference(preferenceKey, locationId);
      },
    }),
    [
      accessibleIds,
      canReadOperationalAccess,
      isDenied,
      isReady,
      locations,
      preferenceKey,
      query.data?.mainLocationId,
      selectedLocationId,
    ],
  );

  return (
    <BusinessLocationContext.Provider value={value}>{children}</BusinessLocationContext.Provider>
  );
}

export function useBusinessLocation(): BusinessLocationContextValue {
  const context = useContext(BusinessLocationContext);
  if (!context) throw new Error('BusinessLocationProvider is missing.');
  return context;
}
