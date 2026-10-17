export type PasswordLinkFailure = 'cooldown' | 'unavailable' | 'failed';

export class PasswordLinkRequestError extends Error {
  public constructor(public readonly reason: PasswordLinkFailure) {
    super(`PASSWORD_LINK_${reason.toUpperCase()}`);
  }
}

/**
 * Asks the Runtime to deliver a one-time password link to the signed-in user's registered phone.
 * Nothing about the destination or the link crosses the browser: the Runtime resolves both, and
 * the current session stays valid until the password is actually changed through the link.
 */
export async function requestOwnPasswordLink(options: {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
}): Promise<void> {
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
    throw new PasswordLinkRequestError('failed');
  }
  if (response.ok) return;
  let code = '';
  try {
    code = ((await response.json()) as { error?: { code?: string } }).error?.code ?? '';
  } catch {
    // The generic failure below is the safe answer for an unreadable body.
  }
  if (code === 'PASSWORD_RESET_COOLDOWN') throw new PasswordLinkRequestError('cooldown');
  if (response.status === 503) throw new PasswordLinkRequestError('unavailable');
  throw new PasswordLinkRequestError('failed');
}

export type PasswordChangeFailure = 'incorrect' | 'policy' | 'throttled' | 'session' | 'failed';

export class PasswordChangeError extends Error {
  public constructor(public readonly reason: PasswordChangeFailure) {
    super(`PASSWORD_CHANGE_${reason.toUpperCase()}`);
  }
}

/**
 * Changes the signed-in user's password by verifying the current one. This deliberately bypasses
 * the shared API client: an incorrect current password answers 401 INVALID_CREDENTIALS, which the
 * client would otherwise read as an expired session and sign the user out. On success the Runtime
 * has already revoked every session of the account, including this one.
 */
export async function changeOwnPassword(options: {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const token = await options.getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${options.apiBaseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        currentPassword: options.currentPassword,
        newPassword: options.newPassword,
      }),
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
    // An unreadable body falls through to the generic failure.
  }
  if (code === 'INVALID_CREDENTIALS') throw new PasswordChangeError('incorrect');
  if (code === 'PASSWORD_POLICY_VIOLATION' || code === 'VALIDATION_ERROR')
    throw new PasswordChangeError('policy');
  if (response.status === 429) throw new PasswordChangeError('throttled');
  if (response.status === 401) throw new PasswordChangeError('session');
  throw new PasswordChangeError('failed');
}
