import type { ApiClient } from '@digvation/business-api';

export interface WorkshopCustomer {
  id: string;
  name: string;
  phoneE164: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface WorkshopVehicle {
  id: string;
  customerId: string;
  plateNumber: string;
  chassisNumber: string;
  engineNumber: string;
  version: number;
}

export interface WorkshopWorkOrder {
  id: string;
  workOrderNumber: string;
  sellingLocationId: string;
  customerId: string;
  vehicleId: string;
  customerNameSnapshot: string;
  customerPhoneSnapshot: string;
  vehiclePlateSnapshot: string;
  vehicleChassisNumberSnapshot: string;
  vehicleEngineNumberSnapshot: string;
  customerRequest: string;
  version: number;
  createdAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
}

type NewVehicleInput = {
  plateNumber: string;
  chassisNumber: string;
  engineNumber: string;
};

/**
 * Thin transport wrapper only. Canonical Customer identity is the shared
 * `/api/v1/customers` authority; Workshop Vehicle/Work Order intake is the
 * new Workshop-owned endpoint family. This never becomes a second Customer
 * store — Runtime remains the single source of truth for every response.
 */
export class WorkshopIntakeApi {
  constructor(private readonly client: ApiClient) {}

  searchCustomers(query: string) {
    const params = new URLSearchParams({ limit: '20', offset: '0', status: 'ACTIVE' });
    if (query.trim()) params.set('q', query.trim());
    return this.client.get<Page<WorkshopCustomer>>(`/api/v1/customers?${params.toString()}`);
  }

  createCustomer(input: { name: string; phone: string }) {
    return this.client.post<WorkshopCustomer>('/api/v1/customers', input);
  }

  listVehicles(customerId: string, query = '') {
    const params = new URLSearchParams({ customerId, limit: '50', offset: '0' });
    if (query.trim()) params.set('q', query.trim());
    return this.client.get<Page<WorkshopVehicle>>(`/api/v1/workshop/vehicles?${params.toString()}`);
  }

  createWorkOrder(
    input: {
      sellingLocationId: string;
      customerId: string;
      customerRequest: string;
      vehicleId?: string;
    } & Partial<NewVehicleInput>,
    idempotencyKey: string,
  ) {
    return this.client.post<WorkshopWorkOrder>('/api/v1/workshop/work-orders', input, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }
}
