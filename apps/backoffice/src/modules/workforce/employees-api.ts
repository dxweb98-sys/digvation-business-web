import type { ApiClient } from '@digvation/business-api';

export type RecordStatus = 'ACTIVE' | 'INACTIVE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'SICK';

export interface EmployeePosition {
  id: string;
  code: string;
  name: string;
  serviceAssignmentEnabled: boolean;
  status: RecordStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  code: string;
  displayName: string;
  positionId: string | null;
  position: EmployeePosition | null;
  joinedOn: string | null;
  status: RecordStatus;
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

export interface EmployeePositionPage {
  items: EmployeePosition[];
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

export interface EmployeeAttendance {
  id: string;
  employeeId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
  source: 'LOCAL' | 'HRIS';
  externalReference: string | null;
  recordedByActorId: string;
  recordedByActorKind: string;
  updatedByActorId: string;
  updatedByActorKind: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeAttendancePage {
  items: EmployeeAttendance[];
  total: number;
  limit: number;
  offset: number;
}

export interface EmployeeQuery {
  q?: string;
  status?: Employee['status'];
  positionId?: string;
  limit: number;
  offset: number;
}

export interface EmployeePositionQuery {
  q?: string;
  status?: EmployeePosition['status'];
  limit: number;
  offset: number;
}

export interface AttendanceQuery {
  employeeId?: string;
  from?: string;
  to?: string;
  status?: AttendanceStatus;
  limit: number;
  offset: number;
}

export interface CreateEmployeeInput {
  code?: string;
  displayName: string;
  positionId?: string | null;
  joinedOn?: string | null;
}

export interface UpdateEmployeeInput {
  displayName?: string;
  positionId?: string | null;
  status?: Employee['status'];
  joinedOn?: string | null;
  statusReason?: string | null;
}

export interface CreateEmployeePositionInput {
  code?: string;
  name: string;
  serviceAssignmentEnabled: boolean;
}

export interface UpdateEmployeePositionInput {
  name?: string;
  serviceAssignmentEnabled?: boolean;
  status?: EmployeePosition['status'];
}

export interface UpsertAttendanceInput {
  status: AttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  note?: string | null;
}

function queryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export class EmployeesApi {
  public constructor(private readonly client: ApiClient) {}

  list(query: EmployeeQuery) {
    return this.client.get<EmployeePage>(
      `/api/v1/employees?${queryString(query as unknown as Record<string, string | number | undefined>)}`,
    );
  }

  get(id: string) {
    return this.client.get<EmployeeDetail>(`/api/v1/employees/${id}`);
  }

  create(input: CreateEmployeeInput) {
    return this.client.post<Employee>('/api/v1/employees', input);
  }

  update(employee: Employee, input: UpdateEmployeeInput) {
    return this.client.patch<Employee>(`/api/v1/employees/${employee.id}`, {
      expectedVersion: employee.version,
      ...input,
    });
  }

  listPositions(query: EmployeePositionQuery) {
    return this.client.get<EmployeePositionPage>(
      `/api/v1/employees/positions?${queryString(query as unknown as Record<string, string | number | undefined>)}`,
    );
  }

  createPosition(input: CreateEmployeePositionInput) {
    return this.client.post<EmployeePosition>('/api/v1/employees/positions', input);
  }

  updatePosition(position: EmployeePosition, input: UpdateEmployeePositionInput) {
    return this.client.patch<EmployeePosition>(`/api/v1/employees/positions/${position.id}`, {
      expectedVersion: position.version,
      ...input,
    });
  }

  listAttendance(query: AttendanceQuery) {
    return this.client.get<EmployeeAttendancePage>(
      `/api/v1/employees/attendance?${queryString(query as unknown as Record<string, string | number | undefined>)}`,
    );
  }

  upsertAttendance(employeeId: string, date: string, input: UpsertAttendanceInput) {
    return this.client.put<EmployeeAttendance>(
      `/api/v1/employees/attendance/${employeeId}/${date}`,
      input,
    );
  }
}
