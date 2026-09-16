import type { ApiClient } from '@digvation/business-api';

export interface AccessRole {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  systemKey: 'OWNER' | null;
  version: number;
  permissions: string[];
}

export interface AccessPermissionLabel {
  id: string;
  en: string;
}

export interface AccessPermissionGroupMetadata {
  key: string;
  label: AccessPermissionLabel;
  order: number;
}

export interface AccessPermission {
  key: string;
  label: AccessPermissionLabel;
  product: string | null;
  capability: string | null;
  section: AccessPermissionGroupMetadata;
  businessArea: AccessPermissionGroupMetadata;
  surface: 'BACKOFFICE' | 'OPERATIONAL' | 'BOTH' | 'SYSTEM';
  configurable: boolean;
  order: number;
}

export interface AccessUser {
  id: string;
  username: string | null;
  displayName: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'DISABLED';
  version: number;
  roles: AccessRole[];
}

export type InvitationDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface UserInvitation {
  id: string;
  phoneE164: string;
  username: string | null;
  displayName: string;
  expiresAt: string;
  resendAvailableAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  roles: AccessRole[];
  deliveryStatus: InvitationDeliveryStatus;
  lastDeliveryAt: string | null;
  deliveryErrorCode: string | null;
  providerMessageId: string | null;
  deliveryAttempts: number;
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
    return this.client.get<Page<AccessPermission>>('/api/v1/roles/permissions');
  }
  listUsers(page: PageRequest) {
    return this.client.get<Page<AccessUser>>(
      `/api/v1/users?limit=${page.limit}&offset=${page.offset}`,
    );
  }
  listInvitations(page: PageRequest) {
    return this.client.get<Page<UserInvitation>>(
      `/api/v1/user-invitations?limit=${page.limit}&offset=${page.offset}`,
    );
  }
  createInvitation(input: {
    phoneE164: string;
    username?: string;
    displayName: string;
    roleIds: string[];
  }) {
    return this.client.post<UserInvitation>('/api/v1/user-invitations', input);
  }
  resendInvitation(id: string) {
    return this.client.post<{ completed: true }>(`/api/v1/user-invitations/${id}/resend`, {});
  }
  revokeInvitation(id: string) {
    return this.client.post<UserInvitation>(`/api/v1/user-invitations/${id}/revoke`, {});
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
