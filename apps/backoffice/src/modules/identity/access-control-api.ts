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
  foundation: string | null;
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
  /** Optional; used for recovery only once its owner verified it. */
  email?: string | null;
  emailVerifiedAt?: string | null;
  version: number;
  roles: AccessRole[];
}

export interface UserInvitation {
  id: string;
  phoneE164: string;
  username: string | null;
  displayName: string;
  email?: string | null;
  expiresAt: string;
  resendAvailableAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  roles: AccessRole[];
}

/** The signed-in user's own account, as the Runtime reports it. */
export interface SelfProfile {
  id: string;
  username: string | null;
  displayName: string;
  phoneE164: string;
  email: string | null;
  emailVerifiedAt: string | null;
  version: number;
  roles: Array<{ id: string; code: string; name: string; systemKey: 'OWNER' | null }>;
}

export type PasswordResetStatus =
  'PENDING' | 'DELIVERY_FAILED' | 'EXPIRED' | 'COMPLETED' | 'CANCELLED' | 'SUPERSEDED' | 'CLOSED';

/** One password link request: states and actors only, never the link or token. */
export interface PasswordResetChallenge {
  id: string;
  status: PasswordResetStatus;
  requestedAt: string;
  expiresAt: string;
  resendAvailableAt: string;
  requestedVia: 'SELF' | 'ADMIN' | 'PUBLIC' | null;
  requestedBy: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  supersededAt: string | null;
  replacedByChallengeId: string | null;
  deliveryFailedAt: string | null;
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

  getSelf() {
    return this.client.get<SelfProfile>('/api/v1/auth/me');
  }
  /** Self-service only; roles, status and phone are never sent. */
  updateSelf(input: { displayName?: string; username?: string; email?: string | null }) {
    return this.client.patch<SelfProfile>('/api/v1/auth/me', input);
  }
  requestOwnEmailVerification() {
    return this.client.post<{ completed: true }>('/api/v1/auth/email-verification/request', {});
  }
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
    email: string;
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
  updateUser(
    user: AccessUser,
    input: {
      displayName?: string;
      username?: string;
      status?: 'ACTIVE' | 'DISABLED';
      /** A new address is saved unverified; null removes it. */
      email?: string | null;
    },
  ) {
    return this.client.patch<AccessUser>(`/api/v1/users/${user.id}`, {
      expectedVersion: user.version,
      ...input,
    });
  }
  /** Sends a one-time ownership link to the user's unverified email; the caller never sees it. */
  requestUserEmailVerification(user: AccessUser) {
    return this.client.post<{ completed: true }>(`/api/v1/users/${user.id}/email-verification`, {});
  }
  /**
   * Sends a one-time password link: to the user's verified email, otherwise to the registered
   * phone. The caller never sees it.
   */
  requestUserPasswordLink(user: AccessUser) {
    return this.client.post<{ completed: true }>(`/api/v1/users/${user.id}/password-reset`, {});
  }
  async listPasswordResets(userId: string) {
    const page = await this.client.get<Page<PasswordResetChallenge>>(
      `/api/v1/users/${userId}/password-resets`,
    );
    return page.items;
  }
  cancelPasswordReset(userId: string, challengeId: string) {
    return this.client.post<PasswordResetChallenge>(
      `/api/v1/users/${userId}/password-resets/${challengeId}/cancel`,
      {},
    );
  }
  replaceUserRoles(user: AccessUser, roleIds: string[]) {
    return this.client.put<AccessUser>(`/api/v1/users/${user.id}/roles`, {
      expectedVersion: user.version,
      roleIds,
    });
  }
}
