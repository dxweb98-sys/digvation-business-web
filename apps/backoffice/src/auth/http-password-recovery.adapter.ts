import {
  PasswordRecoveryUnavailableError,
  PasswordResetError,
  type PasswordRecoveryPort,
  type PasswordRecoveryRequest,
  type PasswordResetDestination,
  type PasswordResetReference,
} from './password-recovery';

interface ApiEnvelope {
  success?: boolean;
  data?: { destination?: PasswordResetDestination };
  error?: { code?: string };
}

const REJECTION_BY_CODE: Record<string, PasswordResetError['reason']> = {
  PASSWORD_RESET_INVALID: 'invalid',
  PASSWORD_RESET_EXPIRED: 'expired',
  PASSWORD_POLICY_VIOLATION: 'password-policy',
  EMAIL_VERIFICATION_INVALID: 'invalid',
  EMAIL_VERIFICATION_EXPIRED: 'expired',
  VALIDATION_ERROR: 'invalid',
};

/**
 * Public Runtime adapter for verified-email password recovery. The workspace comes from trusted
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
    const response = await this.post('password-reset/request', {
      workspace: this.workspace,
      identifier: input.email.trim().toLowerCase(),
    });
    if (!response.ok) throw new Error('PASSWORD_RECOVERY_REQUEST_FAILED');
  }

  public async confirm(input: PasswordResetReference & { newPassword: string }): Promise<{ destination: PasswordResetDestination }> {
    const response = await this.post('password-reset/link/confirm', {
      workspace: input.workspace,
      challengeId: input.challengeId,
      token: input.token,
      newPassword: input.newPassword,
    });
    await rejection(response);
    const payload = (await response.json()) as ApiEnvelope;
    const destination = payload.data?.destination;
    if (destination !== 'BACKOFFICE' && destination !== 'OPERATIONAL' && destination !== 'NONE')
      throw new PasswordResetError('network');
    return { destination };
  }

  public async confirmEmailVerification(input: PasswordResetReference): Promise<void> {
    const response = await this.post('email-verification/confirm', {
      workspace: input.workspace,
      challengeId: input.challengeId,
      token: input.token,
    });
    return rejection(response);
  }

  private async post(
    action: 'password-reset/request' | 'password-reset/link/confirm' | 'email-verification/confirm',
    body: Record<string, string>,
  ) {
    try {
      return await fetch(`${this.apiBaseUrl}/api/v1/auth/${action}`, {
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

/** Maps a Runtime refusal of a one-time link to what the person can do next. */
async function rejection(response: Response): Promise<void> {
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

/**
 * A typed phone number (08…, 62…, +62…) is sent as canonical E.164 so it matches the stored
 * number; anything else is a username and is sent as typed.
 */
function normalizeRecoveryIdentifier(identifier: string): string {
  const trimmed = identifier.trim();
  if (!/^[+\d][\d\s().+-]*$/.test(trimmed)) return trimmed;
  return trimmed;
}
