import type { ApiClient } from '@digvation/business-api';

export interface ActivityEvent {
  id: string; occurredAt: string; eventType: string; category: string; targetType: string | null; targetRef: string | null;
  correlationId: string | null; locationId: string | null; locationName: string | null; source: 'BACKOFFICE' | 'OPERATIONAL' | 'SYSTEM'; outcome: string;
  actor: { id: string | null; displayName: string } | null;
  target: { type: string; id?: string | null; displayName?: string; reference?: string } | null;
}
export interface ActivityPageResult { items: ActivityEvent[]; total: number; limit: number; offset: number; }
type Query = Record<string, string | number | undefined>;
export class ActivityApi {
  constructor(private readonly client: ApiClient) {}
  list(query: Query) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [string, string][]);
    return this.client.get<ActivityPageResult>(`/api/v1/activity?${params}`);
  }
}
