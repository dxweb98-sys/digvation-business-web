export interface AuthRoleIdentity {
  id: string;
  code: string;
  name: string;
  systemKey: string | null;
}

export interface AuthIdentity {
  userId: string;
  displayName: string;
  username: string | null;
  roles: readonly AuthRoleIdentity[];
}

export interface SessionBusiness {
  tenantId: string;
  name: string;
  currency: string;
}

export interface SessionAccess {
  readonly products: readonly string[];
  readonly capabilities: readonly string[];
  readonly foundations: readonly string[];
  readonly permissions: readonly string[];
}

export interface SessionPreferences {
  locale: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

export interface SessionDeployment {
  profile: string;
}

/** Canonical authenticated session contract returned by Business Runtime. */
export interface AuthSession {
  identity: AuthIdentity;
  business: SessionBusiness;
  access: SessionAccess;
  preferences: SessionPreferences;
  deployment: SessionDeployment;
  contextVersion: string;
}

/**
 * Transitional browser-only aliases for screens that have not yet moved from
 * the former runtime/auth overlays. Every value is derived from AuthSession;
 * these fields never introduce a second authorization authority.
 */
export interface LegacyCompatibleAuthSession extends AuthSession {
  identity: AuthIdentity & {
    readonly workspace: string;
    readonly permissions: readonly string[];
  };
  readonly effectiveEntitlements: {
    readonly products: readonly string[];
    readonly capabilities: readonly string[];
  };
  readonly effectiveFoundations: readonly string[];
  readonly effectivePermissions: readonly string[];
}

export interface AuthLoginInput {
  workspace?: string;
  identifier: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthPasswordChangeRequestInput {
  email: string;
}

export type SessionEndReason = 'idle' | 'invalid';

export type AuthRefreshResult =
  | { kind: 'refreshed'; accessToken: string }
  | { kind: 'deferred' }
  | { kind: 'ended'; reason: SessionEndReason };

export interface AuthPort {
  me(): Promise<AuthSession | null>;
  login(input: AuthLoginInput): Promise<AuthSession>;
  logout(): Promise<void>;
  refreshSessionContext(): Promise<AuthSession | null>;
  requestPasswordChange(input: AuthPasswordChangeRequestInput): Promise<void>;
  getAccessToken?(forceRefresh?: boolean): Promise<string | null>;
  refreshAccessToken?(): Promise<AuthRefreshResult>;
  subscribeSessionEnded?(listener: (reason: SessionEndReason) => void): () => void;
}
