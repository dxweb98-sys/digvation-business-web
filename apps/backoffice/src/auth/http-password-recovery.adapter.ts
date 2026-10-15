import { toCanonicalMemberPhone } from '../modules/membership/member-phone';
import {
  PasswordRecoveryUnavailableError,
  PasswordResetError,
  type PasswordRecoveryPort,
  type PasswordRecoveryRequest,
  type PasswordResetReference,
} from './password-recovery';

interface ApiEnvelope {
  success?: boolean;
  error?: { code?: string };
}

const REJECTION_BY_CODE: Record<string, PasswordResetError['reason']> = {
  PASSWORD_RESET_INVALID: 'invalid',
  PASSWORD_RESET_EXPIRED: 'expired',
  PASSWORD_POLICY_VIOLATION: 'password-policy',
  VALIDATION_ERROR: 'invalid',
};

/**
 * Public Runtime adapter for WhatsApp password recovery. The workspace comes from trusted
 * deployment bootstrap, never from user input; the reset credential travels only in the POST body.
 */
export class HttpPasswordRecoveryAdapter implements PasswordRecoveryPort {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string | undefined,
  ) {}

  public async request(input: PasswordRecoveryRequest): Promise<void> {
    if (!this.workspace) throw new PasswordRecoveryUnavailableError();
    // The Runtime answers identically for known and unknown accounts (non-enumerating).
    const response = await this.post('request', {
      workspace: this.workspace,
      identifier: normalizeRecoveryIdentifier(input.identifier),
    });
    if (!response.ok) throw new Error('PASSWORD_RECOVERY_REQUEST_FAILED');
  }

  public async confirm(input: PasswordResetReference & { newPassword: string }): Promise<void> {
    const response = await this.post('link/confirm', {
      workspace: input.workspace,
      challengeId: input.challengeId,
      token: input.token,
      newPassword: input.newPassword,
    });
    if (response.ok) return;
    let payload: ApiEnvelope;
    try {
      payload = (await response.json()) as ApiEnvelope;
    } catch {
      throw new PasswordResetError('network');
    }
    throw new PasswordResetError(
      REJECTION_BY_CODE[payload.error?.code ?? ''] ??
        (response.status >= 500 ? 'network' : 'invalid'),
    );
  }

  private async post(action: 'request' | 'link/confirm', body: Record<string, string>) {
    try {
      return await fetch(`${this.apiBaseUrl}/api/v1/auth/password-reset/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      throw new PasswordResetError('network');
    }
  }
}

/**
 * A typed phone number (08…, 62…, +62…) is sent as canonical E.164 so it matches the stored
 * number; anything else is a username and is sent as typed.
 */
function normalizeRecoveryIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!/^[+\d][\d\s().+-]*$/.test(trimmed)) return trimmed;
  return toCanonicalMemberPhone(trimmed) ?? trimmed;
}
