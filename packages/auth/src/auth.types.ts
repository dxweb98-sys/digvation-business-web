export interface AuthIdentity {
  userId: string;
  displayName: string;
  email?: string;
  initials?: string;
  avatarUrl?: string;
  workspace: string;
  permissions: readonly string[];
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
  getAccessToken?(): Promise<string | null>;
  refreshAccessToken?(): Promise<AuthRefreshResult>;
  subscribeSessionEnded?(listener: (reason: SessionEndReason) => void): () => void;
}
