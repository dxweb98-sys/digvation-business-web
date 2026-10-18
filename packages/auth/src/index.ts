export { AuthProvider, useAuth, useOptionalAuth } from './auth-context';
export { BrowserSessionClient, BrowserSessionRequestError } from './browser-session-client';
export { AuthenticationError, HttpAuthAdapter } from './http-auth.adapter';
export { MockAuthAdapter } from './mock-auth.adapter';
export { withLegacySessionAliases } from './session-compat';
export { canUseSessionFeature, hasSessionFeature } from './session-entitlement-access';
export type { SessionFeature } from './session-entitlement-access';
export type {
  AuthIdentity,
  AuthLoginInput,
  AuthPasswordChangeRequestInput,
  AuthPort,
  AuthRefreshResult,
  AuthRoleIdentity,
  AuthSession,
  LegacyCompatibleAuthSession,
  SessionAccess,
  SessionBusiness,
  SessionDeployment,
  SessionEntitlementHierarchy,
  SessionEndReason,
  SessionPreferences,
} from './auth.types';
