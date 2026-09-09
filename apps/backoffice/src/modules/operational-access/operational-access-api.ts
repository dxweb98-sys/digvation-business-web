import type { ApiClient } from '@digvation/pos-api';

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

/** Operational location assignments are a foundation contribution, composed by Access Control. */
export class OperationalAccessApi {
  public constructor(private readonly client: ApiClient) {}
  context() {
    return this.client.get<OperationalAccessContext>('/api/v1/operational-access/context');
  }
  listUserLocations(userId: string) {
    return this.client.get<OperationalLocation[]>(`/api/v1/operational-access/users/${userId}`);
  }
  replaceUserLocations(userId: string, sellingLocationIds: string[]) {
    return this.client.put<OperationalLocation[]>(`/api/v1/operational-access/users/${userId}`, {
      sellingLocationIds,
    });
  }
}
