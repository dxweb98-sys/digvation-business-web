import {
  AccountActivationError,
  type AccountActivationPort,
  type ActivationLinkInspection,
  type ActivationLinkReference,
  type ActivationLinkStatus,
} from './account-activation';

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { code?: string };
}

const STATUSES: readonly ActivationLinkStatus[] = [
  'VALID',
  'EXPIRED',
  'USED',
  'REVOKED',
  'INVALID',
];

const REJECTION_BY_CODE: Record<string, AccountActivationError['reason']> = {
  ACTIVATION_LINK_EXPIRED: 'expired',
  ACTIVATION_LINK_USED: 'used',
  ACTIVATION_LINK_REVOKED: 'revoked',
  ACTIVATION_LINK_INVALID: 'invalid',
  PASSWORD_POLICY_VIOLATION: 'password-policy',
  // The form enforces the password length, so a request-validation failure means a malformed link.
  VALIDATION_ERROR: 'invalid',
};

/** Public Runtime adapter; the link credential is sent only in the POST body. */
export class HttpAccountActivationAdapter implements AccountActivationPort {
  public constructor(private readonly apiBaseUrl: string) {}

  public async inspect(reference: ActivationLinkReference): Promise<ActivationLinkInspection> {
    const payload = await this.post<ActivationLinkInspection>('inspect', {
      workspace: reference.workspace,
      invitationId: reference.invitationId,
      token: reference.token,
    });
    if (!payload.data || !STATUSES.includes(payload.data.status))
      throw new AccountActivationError('network');
    return payload.data.status === 'VALID' && payload.data.businessName
      ? { status: 'VALID', businessName: payload.data.businessName }
      : { status: payload.data.status === 'VALID' ? 'INVALID' : payload.data.status };
  }

  public async activate(reference: ActivationLinkReference & { password: string }): Promise<void> {
    await this.post('activate', {
      workspace: reference.workspace,
      invitationId: reference.invitationId,
      token: reference.token,
      password: reference.password,
    });
  }

  private async post<T>(
    action: 'inspect' | 'activate',
    body: Record<string, string>,
  ): Promise<ApiEnvelope<T>> {
    let response: Response;
    try {
      response = await fetch(
        `${this.apiBaseUrl}/api/v1/auth/invitations/activation-link/${action}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        },
      );
    } catch {
      throw new AccountActivationError('network');
    }
    let payload: ApiEnvelope<T>;
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      throw new AccountActivationError('network');
    }
    if (response.ok && payload.success !== false) return payload;
    const code = payload.error?.code ?? '';
    throw new AccountActivationError(
      REJECTION_BY_CODE[code] ?? (response.status >= 500 ? 'network' : 'invalid'),
    );
  }
}
