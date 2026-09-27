import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { referenceQueryPolicy } from '../../app/data/operational-cache-policy';

export interface OperationalLocation {
  id: string;
  code: string;
  name: string;
  address: string | null;
}

export interface OperationalAccessContext {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
  /** Canonical tenant Main Branch, exposed only when it is permitted to this user. */
  mainLocationId: string | null;
  locations: OperationalLocation[];
}

/** Reads the authenticated Operational Access context; it is not a POS location authority. */
export class OperationalAccessApi {
  public constructor(private readonly client: ApiClient) {}

  public context(signal?: AbortSignal): Promise<OperationalAccessContext> {
    return this.client.get('/api/v1/operational-access/context', { signal });
  }
}

export const operationalAccessKeys = {
  context: () => ['operational-access', 'context'] as const,
};

/**
 * Reused wherever Operational needs canonical location identity (name/address),
 * such as the shell branch picker and the receipt preview/print header. React
 * Query dedupes this by key, so consuming it in more than one component never
 * issues a second network request.
 */
export function useOperationalAccessContext() {
  const bootstrap = useDeploymentBootstrap();
  const { authPort } = useAuth();
  const client = useMemo(
    () =>
      new ApiClient({
        baseUrl: bootstrap.apiBaseUrl,
        ...(authPort.getAccessToken
          ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
          : {}),
      }),
    [authPort, bootstrap.apiBaseUrl],
  );
  const api = useMemo(() => new OperationalAccessApi(client), [client]);
  return useQuery({
    queryKey: operationalAccessKeys.context(),
    queryFn: ({ signal }) => api.context(signal),
    ...referenceQueryPolicy,
  });
}
