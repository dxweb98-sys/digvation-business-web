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

export interface SessionEntitlementHierarchy {
  readonly products: {
    readonly POS: {
      readonly enabled: boolean;
      readonly selling: { readonly PRODUCT: boolean; readonly SERVICE: boolean };
      readonly features: { readonly PRODUCT_COMMISSION: boolean };
    };
  };
  readonly modules: {
    readonly ORGANIZATION?: { readonly MULTI_BRANCH: boolean };
    readonly CATALOG: {
      readonly enabled: boolean;
      readonly PRODUCTS: boolean;
      readonly SERVICES: boolean;
    };
    readonly CUSTOMER: {
      readonly enabled: boolean;
      readonly MEMBERSHIP: { readonly enabled: boolean; readonly LOYALTY_POINTS: boolean };
    };
    readonly COMMERCIAL: { readonly PROMOTIONS: boolean };
    readonly EMPLOYEE?: { readonly WORKFORCE: boolean; readonly ATTENDANCE: boolean };
    /** Legacy session compatibility during staged rollouts. */
    readonly WORKFORCE?: { readonly EMPLOYEES: boolean; readonly ATTENDANCE: boolean };
    readonly FINANCE: { readonly OPERATIONS: boolean };
    readonly TAX?: boolean;
    /** Legacy session compatibility during staged rollouts. */
    readonly FISCAL?: { readonly TAX: boolean };
    readonly ANALYTICS?: { readonly BUSINESS_INSIGHTS: boolean };
  };
}

export interface SessionAccess {
  readonly products: readonly string[];
  readonly capabilities: readonly string[];
  /** Additive field: older Runtime versions may omit this during rollout. */
  readonly entitlements?: SessionEntitlementHierarchy;
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
