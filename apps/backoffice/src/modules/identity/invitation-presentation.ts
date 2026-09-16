import type { InvitationDeliveryStatus, UserInvitation } from './access-control-api';

export type InvitationLifecycleStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export function invitationLifecycleStatus(
  invitation: Pick<UserInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
  now = Date.now(),
): InvitationLifecycleStatus {
  if (invitation.acceptedAt) return 'ACTIVE';
  if (invitation.revokedAt) return 'REVOKED';
  if (new Date(invitation.expiresAt).getTime() <= now) return 'EXPIRED';
  return 'PENDING';
}

export function invitationLifecycleLabel(status: InvitationLifecycleStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Aktif';
    case 'EXPIRED':
      return 'Kedaluwarsa';
    case 'REVOKED':
      return 'Dibatalkan';
    default:
      return 'Menunggu aktivasi';
  }
}

export function invitationDeliveryLabel(status: InvitationDeliveryStatus): string {
  switch (status) {
    case 'SENT':
      return 'Terkirim';
    case 'DELIVERED':
      return 'Terkirim ke perangkat';
    case 'READ':
      return 'Dibaca';
    case 'FAILED':
      return 'Gagal dikirim';
    default:
      return 'Menunggu dikirim';
  }
}

export function canResendInvitation(
  invitation: Pick<UserInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt' | 'resendAvailableAt'>,
  canManage: boolean,
  now = Date.now(),
): boolean {
  return (
    canManage &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    new Date(invitation.expiresAt).getTime() > now &&
    new Date(invitation.resendAvailableAt).getTime() <= now
  );
}

export function canRevokeInvitation(
  invitation: Pick<UserInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
  canManage: boolean,
  now = Date.now(),
): boolean {
  return (
    canManage &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    new Date(invitation.expiresAt).getTime() > now
  );
}
