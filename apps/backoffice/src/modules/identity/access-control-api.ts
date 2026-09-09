import type { ApiClient } from '@digvation/pos-api';

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  systemKey: 'OWNER' | null;
  version: number;
  permissions: string[];
}

export interface AccessUser {
  id: string;
  username: string | null;
  displayName: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'DISABLED';
  version: number;
  roles: AccessRole[];
}

export interface Page<T> {
  items: T[];
  total?: number;
  limit: number;
  offset: number;
}

export interface PageRequest {
  limit: number;
  offset: number;
}

export class AccessControlApi {
  public constructor(private readonly client: ApiClient) {}

  listRoles(page: PageRequest) {
    return this.client.get<Page<AccessRole>>(
      `/api/v1/roles?limit=${page.limit}&offset=${page.offset}`,
    );
  }
  listPermissions() {
    return this.client.get<Page<{ key: string }>>('/api/v1/roles/permissions');
  }
  listUsers(page: PageRequest) {
    return this.client.get<Page<AccessUser>>(
      `/api/v1/users?limit=${page.limit}&offset=${page.offset}`,
    );
  }
  createRole(input: { code: string; name: string; permissions: string[] }) {
    return this.client.post<AccessRole>('/api/v1/roles', input);
  }
  updateRole(role: AccessRole, name: string) {
    return this.client.patch<AccessRole>(`/api/v1/roles/${role.id}`, {
      expectedVersion: role.version,
      name,
    });
  }
  replacePermissions(role: AccessRole, permissions: string[]) {
    return this.client.put<AccessRole>(`/api/v1/roles/${role.id}/permissions`, {
      expectedVersion: role.version,
      permissions,
    });
  }
  deactivateRole(role: AccessRole) {
    return this.client.put<AccessRole>(`/api/v1/roles/${role.id}/status`, {
      expectedVersion: role.version,
      status: 'INACTIVE',
    });
  }
  replaceUserRoles(user: AccessUser, roleIds: string[]) {
    return this.client.put<AccessUser>(`/api/v1/users/${user.id}/roles`, {
      expectedVersion: user.version,
      roleIds,
    });
  }
}
