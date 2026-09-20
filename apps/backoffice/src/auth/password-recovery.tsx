import { createContext, useContext, type ReactNode } from 'react';

export interface PasswordRecoveryRequest {
  /** Username or phone number registered on the account. */
  identifier: string;
}

/**
 * Backoffice boundary for the WhatsApp password-recovery engine. Implementations resolve the
 * workspace from trusted deployment bootstrap and deliver to the phone registered on the account;
 * the sign-in surface never collects workspace or destination numbers.
 */
export interface PasswordRecoveryPort {
  request(input: PasswordRecoveryRequest): Promise<void>;
}

export class PasswordRecoveryUnavailableError extends Error {
  public constructor() {
    super('PASSWORD_RECOVERY_UNAVAILABLE');
  }
}

/** Used until the Runtime recovery engine is available to this Web build. Never reports success. */
export const unavailablePasswordRecovery: PasswordRecoveryPort = {
  request: () => Promise.reject(new PasswordRecoveryUnavailableError()),
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
