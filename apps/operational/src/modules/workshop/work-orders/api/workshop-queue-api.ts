import type { ApiClient } from '@digvation/business-api';

export type WorkshopWorkOrderStatus =
  | 'WAITING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'DONE'
  | 'CANCELLED';

export interface WorkshopWorkOrderMechanic {
  employeeId: string;
  displayName: string;
  assignedAt: string;
}

export type WorkshopMechanicAvailability = 'AVAILABLE' | 'BUSY' | 'INELIGIBLE';

/** Runtime derives availability; the browser only presents it. */
export interface WorkshopMechanicCandidate {
  employeeId: string;
  displayName: string;
  availability: WorkshopMechanicAvailability;
  activeWorkOrder: { id: string; workOrderNumber: string } | null;
  openWorkOrderCount: number;
}

export interface WorkshopQueueWorkOrder {
  id: string;
  workOrderNumber: string;
  workStatus: WorkshopWorkOrderStatus;
  sellingLocationId: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  vehiclePlateSnapshot: string;
  vehicleChassisNumberSnapshot: string;
  customerRequest: string;
  cancellationReason: string | null;
  mechanic: WorkshopWorkOrderMechanic | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Field names here are the Runtime `WorkshopQueueQueryDto` contract exactly:
 * `q` (search) and `status` (filter), not `workOrderNumber`/`workStatus` —
 * Runtime's global ValidationPipe uses `forbidNonWhitelisted: true`, so any
 * other property name is rejected outright with a 400 VALIDATION_ERROR.
 * `sellingLocationId` is the active Operational Location. Runtime validates
 * it against the caller's Operational Access scope (403 when outside it) and
 * never falls back to every tenant location.
 */
export interface WorkshopQueueQuery {
  limit: number;
  offset: number;
  sellingLocationId: string;
  q?: string | undefined;
  status?: WorkshopWorkOrderStatus | undefined;
}

/**
 * Thin transport wrapper only. Runtime remains the sole authority for
 * workStatus and transition validity — every command here returns the
 * refreshed, authoritative Work Order rather than something the caller could
 * use to synthesize local state that survives a Runtime failure.
 *
 * Starting and resuming are rejected by Runtime while the assigned mechanic
 * already works on another Work Order; the browser never predicts that.
 */
export class WorkshopQueueApi {
  constructor(private readonly client: ApiClient) {}

  list(query: WorkshopQueueQuery) {
    const params = new URLSearchParams();
    params.set('limit', String(query.limit));
    params.set('offset', String(query.offset));
    params.set('sellingLocationId', query.sellingLocationId);
    if (query.q?.trim()) {
      params.set('q', query.q.trim());
    }
    if (query.status) params.set('status', query.status);
    return this.client.get<Page<WorkshopQueueWorkOrder>>(
      `/api/v1/workshop/work-orders?${params.toString()}`,
    );
  }

  listMechanics() {
    return this.client.get<Page<WorkshopMechanicCandidate>>('/api/v1/workshop/mechanics');
  }

  assignMechanic(id: string, expectedVersion: number, mechanicEmployeeId: string) {
    return this.client.post<WorkshopQueueWorkOrder>(
      `/api/v1/workshop/work-orders/${id}/mechanic`,
      { expectedVersion, mechanicEmployeeId },
    );
  }

  start(id: string, expectedVersion: number) {
    return this.client.post<WorkshopQueueWorkOrder>(`/api/v1/workshop/work-orders/${id}/start`, {
      expectedVersion,
    });
  }

  pause(id: string, expectedVersion: number) {
    return this.client.post<WorkshopQueueWorkOrder>(`/api/v1/workshop/work-orders/${id}/pause`, {
      expectedVersion,
    });
  }

  resume(id: string, expectedVersion: number) {
    return this.client.post<WorkshopQueueWorkOrder>(`/api/v1/workshop/work-orders/${id}/resume`, {
      expectedVersion,
    });
  }

  complete(id: string, expectedVersion: number) {
    return this.client.post<WorkshopQueueWorkOrder>(
      `/api/v1/workshop/work-orders/${id}/complete`,
      { expectedVersion },
    );
  }

  cancel(id: string, expectedVersion: number, reason: string) {
    return this.client.post<WorkshopQueueWorkOrder>(`/api/v1/workshop/work-orders/${id}/cancel`, {
      expectedVersion,
      reason,
    });
  }
}
