import { describe, expect, it } from 'vitest';
import {
  canResendInvitation,
  invitationDeliveryLabel,
  invitationLifecycleStatus,
} from './invitation-presentation';

const now = new Date('2026-09-16T12:00:00.000Z').getTime();

const invitation = {
  acceptedAt: null,
  revokedAt: null,
  expiresAt: '2026-09-16T13:00:00.000Z',
  resendAvailableAt: '2026-09-16T11:59:00.000Z',
};

describe('invitation presentation', () => {
  it('keeps invitation lifecycle separate from WhatsApp delivery state', () => {
    expect(invitationLifecycleStatus(invitation, now)).toBe('PENDING');
    expect(invitationDeliveryLabel('PENDING')).toBe('Menunggu dikirim');
    expect(invitationDeliveryLabel('SENT')).toBe('Terkirim');
    expect(invitationDeliveryLabel('FAILED')).toBe('Gagal dikirim');
  });

  it('does not allow resending an expired invitation', () => {
    expect(
      canResendInvitation(
        { ...invitation, expiresAt: '2026-09-16T11:59:59.000Z' },
        true,
        now,
      ),
    ).toBe(false);
  });

  it('allows an Owner-facing retry only after the resend cooldown', () => {
    expect(canResendInvitation(invitation, true, now)).toBe(true);
    expect(
      canResendInvitation(
        { ...invitation, resendAvailableAt: '2026-09-16T12:01:00.000Z' },
        true,
        now,
      ),
    ).toBe(false);
    expect(canResendInvitation(invitation, false, now)).toBe(false);
  });
});
