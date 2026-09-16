import { ApiClient } from '@digvation/business-api';

export type InvitationLinkState =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'USED';

export interface InvitationLinkPreview {
  invitationState: InvitationLinkState;
  businessName?: string;
  displayName?: string;
  username?: string | null;
  maskedPhone?: string;
  expiresAt?: string;
}

export type PasswordResetLinkState = 'VALID' | 'INVALID' | 'EXPIRED' | 'USED';

export interface PasswordResetLinkPreview {
  resetState: PasswordResetLinkState;
  expiresAt?: string;
}

export class PublicAuthApi {
  public constructor(private readonly client: ApiClient) {}

  resolveInvitation(token: string) {
    return this.client.post<InvitationLinkPreview>('/api/v1/auth/invitations/resolve', { token });
  }

  acceptInvitation(token: string, password: string) {
    return this.client.post<{ status: 'ACTIVE' }>('/api/v1/auth/invitations/accept', {
      token,
      password,
    });
  }

  requestPasswordReset(input: { workspace: string; identifier: string }) {
    return this.client.post<{ accepted: true }>('/api/v1/auth/password-reset/request', input);
  }

  resolvePasswordReset(token: string) {
    return this.client.post<PasswordResetLinkPreview>('/api/v1/auth/password-reset/resolve', {
      token,
    });
  }

  completePasswordReset(token: string, newPassword: string) {
    return this.client.post<{ completed: true }>('/api/v1/auth/password-reset/complete', {
      token,
      newPassword,
    });
  }

  requestSelfPasswordReset() {
    return this.client.post<{ accepted: true }>('/api/v1/auth/password-reset/request-self', {});
  }
}
