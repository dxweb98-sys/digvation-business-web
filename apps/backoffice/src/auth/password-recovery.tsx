import { createContext, useContext, type ReactNode } from 'react';

export interface PasswordRecoveryRequest {
  /** Verified account email address. */
  email: string;
}

export interface PasswordResetReference {
  workspace: string;
  challengeId: string;
  /** One-time opaque credential from the link fragment. Never persisted or logged. */
  token: string;
}

export type PasswordResetFailure = 'invalid' | 'expired' | 'password-policy' | 'network';

export class PasswordResetError extends Error {
  public constructor(public readonly reason: PasswordResetFailure) {
    super(`PASSWORD_RESET_${reason.toUpperCase().replace('-', '_')}`);
  }
}

/**
 * Backoffice boundary for verified-email password recovery. Implementations resolve the workspace
 * from trusted deployment bootstrap; the sign-in surface never collects a phone destination.
 */
export interface PasswordRecoveryPort {
  request(input: PasswordRecoveryRequest): Promise<void>;
  /** Completes recovery from the one-time link; the Runtime ends every session of the account. */
  confirm(input: PasswordResetReference & { newPassword: string }): Promise<void>;
  /** Confirms ownership of an account email from its one-time link; recovery may then use it. */
  confirmEmailVerification(input: PasswordResetReference): Promise<void>;
}

export class PasswordRecoveryUnavailableError extends Error {
  public constructor() {
    super('PASSWORD_RECOVERY_UNAVAILABLE');
  }
}

/** Used until the Runtime recovery engine is available to this Web build. Never reports success. */
export const unavailablePasswordRecovery: PasswordRecoveryPort = {
  request: () => Promise.reject(new PasswordRecoveryUnavailableError()),
  confirm: () => Promise.reject(new PasswordResetError('network')),
  confirmEmailVerification: () => Promise.reject(new PasswordResetError('network')),
};

const PasswordRecoveryContext = createContext<PasswordRecoveryPort>(unavailablePasswordRecovery);

export function PasswordRecoveryProvider({
  port,
  children,
}: {
  port: PasswordRecoveryPort;
  children: ReactNode;
}) {
  return (
    <PasswordRecoveryContext.Provider value={port}>{children}</PasswordRecoveryContext.Provider>
  );
}

export function usePasswordRecovery(): PasswordRecoveryPort {
  return useContext(PasswordRecoveryContext);
}
