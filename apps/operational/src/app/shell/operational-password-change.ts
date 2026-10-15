/**
 * Operational boundary for the WhatsApp password-reset link requested from the account dialog.
 *
 * The signed-in operator does not supply any destination: the engine resolves the phone number
 * registered on the account and the workspace from the authenticated session. Until that engine is
 * available to this Web build, `unavailablePasswordChange` reports the feature as unavailable and
 * never claims that a link was sent.
 *
 * `createRuntimePasswordChange` is the Runtime-backed adapter shared by the shell: it asks the
 * Runtime to deliver a one-time link to the account's registered phone. Existing sessions stay
 * valid until the password is actually changed through that link.
 */
export interface OperationalPasswordChangePort {
  /** Sends a one-time reset link to the registered phone (no password is typed). */
  requestResetLink(): Promise<void>;
  /** Changes the password by verifying the current one; every session ends on success. */
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
}

export type PasswordChangeFailure = 'incorrect' | 'policy' | 'throttled' | 'session' | 'failed';

export class PasswordChangeError extends Error {
  public constructor(public readonly reason: PasswordChangeFailure) {
    super(`PASSWORD_CHANGE_${reason.toUpperCase()}`);
  }
}

export class PasswordChangeUnavailableError extends Error {
  public constructor() {
    super('PASSWORD_CHANGE_NOT_SUPPORTED');
  }
}

export const unavailablePasswordChange: OperationalPasswordChangePort = {
  requestResetLink: () => Promise.reject(new PasswordChangeUnavailableError()),
  changePassword: () => Promise.reject(new PasswordChangeUnavailableError()),
};

/** Raised when the Runtime refuses because a link was requested moments ago. */
export class PasswordChangeCooldownError extends Error {
  public constructor() {
    super('PASSWORD_CHANGE_COOLDOWN');
  }
}

export function createRuntimePasswordChange(options: {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
}): OperationalPasswordChangePort {
  return {
    async requestResetLink() {
      const token = await options.getAccessToken();
      let response: Response;
      try {
        response = await fetch(`${options.apiBaseUrl}/api/v1/auth/password-change/request`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: '{}',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        throw new Error('PASSWORD_CHANGE_REQUEST_FAILED');
      }
      if (response.ok) return;
      let code = '';
      try {
        code = ((await response.json()) as { error?: { code?: string } }).error?.code ?? '';
      } catch {
        // fall through to the generic failure
      }
      if (code === 'PASSWORD_RESET_COOLDOWN') throw new PasswordChangeCooldownError();
      throw new Error('PASSWORD_CHANGE_REQUEST_FAILED');
    },
    // Raw fetch on purpose: a wrong current password answers 401 INVALID_CREDENTIALS and must not
    // be treated as an expired session by any shared client.
    async changePassword(input) {
      const token = await options.getAccessToken();
      let response: Response;
      try {
        response = await fetch(`${options.apiBaseUrl}/api/v1/auth/change-password`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(input),
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        throw new PasswordChangeError('failed');
      }
      if (response.ok) return;
      let code = '';
      try {
        code = ((await response.json()) as { error?: { code?: string } }).error?.code ?? '';
      } catch {
        // fall through to the generic failure
      }
      if (code === 'INVALID_CREDENTIALS') throw new PasswordChangeError('incorrect');
      if (code === 'PASSWORD_POLICY_VIOLATION' || code === 'VALIDATION_ERROR')
        throw new PasswordChangeError('policy');
      if (response.status === 429) throw new PasswordChangeError('throttled');
      if (response.status === 401) throw new PasswordChangeError('session');
      throw new PasswordChangeError('failed');
    },
  };
}
