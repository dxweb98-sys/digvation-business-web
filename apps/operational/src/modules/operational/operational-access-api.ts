import { ApiClient } from '@digvation/business-api';

export interface OperationalLocation {
  id: string;
  code: string;
  name: string;
}

export interface OperationalAccessContext {
  organizationWide: boolean;
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
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
