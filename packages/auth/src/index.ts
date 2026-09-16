export { AuthProvider, useAuth, useOptionalAuth } from './auth-context';
export { BrowserSessionClient, BrowserSessionRequestError } from './browser-session-client';
export { AuthenticationError, HttpAuthAdapter } from './http-auth.adapter';
export { MockAuthAdapter } from './mock-auth.adapter';
export { withLegacySessionAliases } from './session-compat';
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
  SessionEndReason,
  SessionPreferences,
} from './auth.types';
