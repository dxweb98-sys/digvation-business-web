export type InvitationStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

/** Terminal states win: an accepted or revoked invitation is never reported as expired. */
export function invitationStatusOf(
  invitation: { acceptedAt: string | null; revokedAt: string | null; expiresAt: string },
  now: number = Date.now(),
): InvitationStatus {
  if (invitation.acceptedAt) return 'ACCEPTED';
  if (invitation.revokedAt) return 'REVOKED';
  return new Date(invitation.expiresAt).getTime() <= now ? 'EXPIRED' : 'PENDING';
}
