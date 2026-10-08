/**
 * Operational boundary for the WhatsApp password-reset link requested from the account dialog.
 *
 * The signed-in operator does not supply any destination: the engine resolves the phone number
 * registered on the account and the workspace from the authenticated session. Until that engine is
 * available to this Web build, `unavailablePasswordChange` reports the feature as unavailable and
 * never claims that a link was sent.
 *
 * Integration point: replace the port passed by `OperationalShell` with a Runtime-backed adapter.
 */
export interface OperationalPasswordChangePort {
  requestResetLink(): Promise<void>;
}

export class PasswordChangeUnavailableError extends Error {
  public constructor() {
    super('PASSWORD_CHANGE_NOT_SUPPORTED');
  }
}

export const unavailablePasswordChange: OperationalPasswordChangePort = {
  requestResetLink: () => Promise.reject(new PasswordChangeUnavailableError()),
};
