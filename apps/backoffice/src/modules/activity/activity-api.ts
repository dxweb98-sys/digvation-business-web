import type { ApiClient } from '@digvation/business-api';

export interface ActivityEvent {
  id: string; occurredAt: string; eventType: string; category: string; targetType: string | null; targetRef: string | null;
  correlationId: string | null; locationId: string | null; locationName: string | null; source: 'BACKOFFICE' | 'OPERATIONAL' | 'SYSTEM'; outcome: string;
  actor: { id: string | null; displayName: string } | null;
  target: { type: string; id?: string | null; displayName?: string; reference?: string } | null;
}
export interface ActivityPageResult { items: ActivityEvent[]; total: number; limit: number; offset: number; }
export interface ActivityFacets {
  actors: { id: string; displayName: string }[];
  locations: { id: string; code: string; name: string; status: 'ACTIVE' | 'INACTIVE' }[];
}
type Query = Record<string, string | number | undefined>;
export class ActivityApi {
  constructor(private readonly client: ApiClient) {}
  list(query: Query) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [string, string][]);
    return this.client.get<ActivityPageResult>(`/api/v1/activity?${params}`);
  }
  facets() {
    return this.client.get<ActivityFacets>('/api/v1/activity/facets');
  }
}
