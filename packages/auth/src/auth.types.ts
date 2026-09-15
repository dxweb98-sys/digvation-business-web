export interface AuthRoleIdentity {
  code: string;
  name: string;
  systemKey?: string | null;
}

export interface AuthIdentity {
  userId: string;
  displayName: string;
  username?: string | null;
  email?: string;
  initials?: string;
  avatarUrl?: string;
  workspace: string;
  permissions: readonly string[];
  roles?: readonly AuthRoleIdentity[];
}

export interface AuthSession {
  identity: AuthIdentity;
}

export interface AuthLoginInput {
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
  requestPasswordChange(input: AuthPasswordChangeRequestInput): Promise<void>;
  getAccessToken?(forceRefresh?: boolean): Promise<string | null>;
  refreshAccessToken?(): Promise<AuthRefreshResult>;
  subscribeSessionEnded?(listener: (reason: SessionEndReason) => void): () => void;
}
