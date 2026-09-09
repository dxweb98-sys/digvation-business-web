export interface BackofficeRole {
  id: string;
  code: string;
  name: string;
  systemKey: string | null;
}

export interface BackofficeIdentity {
  userId: string;
  displayName: string;
  workspace: string;
  permissions: readonly string[];
  roles: readonly BackofficeRole[];
}

export interface BackofficeSession {
  identity: BackofficeIdentity;
  effectiveEntitlements: EffectiveEntitlementConfig;
}

export interface LoginCredentials {
  workspace: string;
  identifier: string;
  password: string;
}
import type { EffectiveEntitlementConfig } from '@digvation/pos-runtime';
