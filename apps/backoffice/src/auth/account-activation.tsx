import { createContext, useContext, type ReactNode } from 'react';

export type ActivationLinkStatus = 'VALID' | 'EXPIRED' | 'USED' | 'REVOKED' | 'INVALID';

export interface ActivationLinkReference {
  workspace: string;
  invitationId: string;
  /** One-time opaque credential from the link fragment. Never persisted or logged. */
  token: string;
}

export interface ActivationLinkInspection {
  status: ActivationLinkStatus;
  /** Present only for a VALID link. */
  businessName?: string;
}

export type AccountActivationFailure =
  'invalid' | 'expired' | 'used' | 'revoked' | 'password-policy' | 'network';

export class AccountActivationError extends Error {
  public constructor(public readonly reason: AccountActivationFailure) {
    super(`ACCOUNT_ACTIVATION_${reason.toUpperCase().replace('-', '_')}`);
  }
}

/**
 * Backoffice boundary for first-time account activation by one-time link. The Runtime owns token
 * verification, expiry, single use and account creation; the browser only carries the credential.
 */
export interface AccountActivationPort {
  inspect(reference: ActivationLinkReference): Promise<ActivationLinkInspection>;
  activate(reference: ActivationLinkReference & { password: string }): Promise<void>;
}

/** Used until the Runtime activation contract is available to this Web build. Never reports success. */
export const unavailableAccountActivation: AccountActivationPort = {
  inspect: () => Promise.reject(new AccountActivationError('network')),
  activate: () => Promise.reject(new AccountActivationError('network')),
};

const AccountActivationContext = createContext<AccountActivationPort>(unavailableAccountActivation);

export function AccountActivationProvider({
  port,
  children,
}: {
  port: AccountActivationPort;
  children: ReactNode;
}) {
  return (
    <AccountActivationContext.Provider value={port}>{children}</AccountActivationContext.Provider>
  );
}

export function useAccountActivation(): AccountActivationPort {
  return useContext(AccountActivationContext);
}
