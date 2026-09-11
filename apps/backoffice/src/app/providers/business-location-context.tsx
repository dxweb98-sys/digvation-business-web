import { useRuntime } from '@digvation/business-runtime';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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

function writePreference(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Branch selection is convenience state only.
  }
}

export function BusinessLocationProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntime();
  const { session, createApiClient } = useBackofficeAuth();
  const api = useMemo(
    () => createApiClient(runtime.apiBaseUrl),
    [createApiClient, runtime.apiBaseUrl],
  );
  const preferenceKey = session
    ? `digvation.backoffice.dashboard.location.v1:${session.identity.workspace}:${session.identity.userId}`
    : 'digvation.backoffice.dashboard.location.v1:anonymous';
  const [preferredLocationId, setPreferredLocationId] = useState<string | null>(null);

  useEffect(() => {
    setPreferredLocationId(readPreference(preferenceKey));
  }, [preferenceKey]);

  const query = useQuery({
    queryKey: ['operational-location-context'],
    queryFn: () => api.get<OperationalAccess>('/api/v1/operational-access/context'),
    enabled: Boolean(session),
  });

  const locations = useMemo(() => {
    const all = [...(query.data?.locations ?? [])];
    all.sort((left, right) => {
      if (left.id === query.data?.mainLocationId) return -1;
      if (right.id === query.data?.mainLocationId) return 1;
      return (left.name ?? left.displayName ?? left.code).localeCompare(
        right.name ?? right.displayName ?? right.code,
      );
    });
    return all;
  }, [query.data?.locations, query.data?.mainLocationId]);

  const accessibleIds = useMemo(
    () => new Set(locations.map((location) => location.id)),
    [locations],
  );
  const preferredIsValid = Boolean(
    preferredLocationId && accessibleIds.has(preferredLocationId),
  );
  const fallbackLocationId =
    query.data?.mainLocationId ??
    (query.data?.resolution === 'AUTO_RESOLVED'
      ? (query.data.selectedLocationId ?? '')
      : locations.length === 1
        ? locations[0]!.id
        : '');
  const selectedLocationId = preferredIsValid
    ? (preferredLocationId ?? '')
    : fallbackLocationId;
  const isDenied = query.data?.resolution === 'DENIED';
  const isReady = Boolean(
    query.data &&
      !isDenied &&
      selectedLocationId &&
      accessibleIds.has(selectedLocationId),
  );

  const value = useMemo<BusinessLocationContextValue>(
    () => ({
      locations,
      selectedLocationId,
      mainLocationId: query.data?.mainLocationId ?? null,
      isReady,
      isDenied,
      selectLocation(locationId: string) {
        if (!accessibleIds.has(locationId)) return;
        setPreferredLocationId(locationId);
        writePreference(preferenceKey, locationId);
      },
    }),
    [
      accessibleIds,
      isDenied,
      isReady,
      locations,
      preferenceKey,
      query.data?.mainLocationId,
      selectedLocationId,
    ],
  );

  return (
    <BusinessLocationContext.Provider value={value}>
      {children}
    </BusinessLocationContext.Provider>
  );
}

export function useBusinessLocation(): BusinessLocationContextValue {
  const context = useContext(BusinessLocationContext);
  if (!context) throw new Error('BusinessLocationProvider is missing.');
  return context;
}
