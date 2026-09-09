import type { ApiClient } from '@digvation/business-api';

export interface Employee {
  id: string;
  code: string;
  displayName: string;
  joinedOn: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeePage {
  items: Employee[];
  total: number;
  limit: number;
  offset: number;
}

export interface EmployeeStatusHistoryEntry {
  id: string;
  previousStatus: Employee['status'];
  newStatus: Employee['status'];
  reason: string | null;
  transitionedAt: string;
  actorId: string;
  actorKind: string;
}

export interface EmployeeDetail extends Employee {
  statusHistory: EmployeeStatusHistoryEntry[];
}

export interface EmployeeQuery {
  q?: string;
  status?: Employee['status'];
  limit: number;
  offset: number;
}

export class EmployeesApi {
  public constructor(private readonly client: ApiClient) {}

  list(query: EmployeeQuery) {
    const params = new URLSearchParams(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== '') as [
        string,
        string,
      ][],
    );
    return this.client.get<EmployeePage>(`/api/v1/employees?${params.toString()}`);
  }

  get(id: string) {
    return this.client.get<EmployeeDetail>(`/api/v1/employees/${id}`);
  }

  create(input: { code?: string; displayName: string; joinedOn?: string | null }) {
    return this.client.post<Employee>('/api/v1/employees', input);
  }

  update(employee: Employee, input: {
    displayName?: string;
    status?: Employee['status'];
    joinedOn?: string | null;
    statusReason?: string | null;
  }) {
    return this.client.patch<Employee>(`/api/v1/employees/${employee.id}`, {
      expectedVersion: employee.version,
      ...input,
    });
  }
}
