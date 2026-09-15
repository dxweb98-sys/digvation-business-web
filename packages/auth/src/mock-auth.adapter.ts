import type {
  AuthLoginInput,
  AuthPasswordChangeRequestInput,
  AuthPort,
  AuthSession,
} from './auth.types';

const SESSION_STORAGE_KEY = 'digvation.pos.auth.mock-session.v1';
const MOCK_LOGIN_LATENCY_MS = 850;
const MOCK_SECURITY_LATENCY_MS = 500;

const DEVELOPMENT_SESSION: AuthSession = {
  identity: {
    userId: 'demo-cashier',
    displayName: 'Demo Cashier',
    email: 'cashier@demo.digvation.local',
    initials: 'DC',
    workspace: 'local-development',
    permissions: ['auth:self'],
  },
};

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const identity = (value as { identity?: unknown }).identity;
  return (
    Boolean(identity) &&
    typeof identity === 'object' &&
    typeof (identity as { userId?: unknown }).userId === 'string' &&
    typeof (identity as { displayName?: unknown }).displayName === 'string' &&
    typeof (identity as { workspace?: unknown }).workspace === 'string' &&
    Array.isArray((identity as { permissions?: unknown }).permissions)
  );
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function restorePersistedSession(): AuthSession | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAuthSession(parsed) ? structuredClone(parsed) : null;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    if (session) storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Browser storage is optional for the local adapter.
  }
}

function waitForMockLogin() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, MOCK_LOGIN_LATENCY_MS));
}

function waitForMockSecurityAction() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, MOCK_SECURITY_LATENCY_MS));
}

export class MockAuthAdapter implements AuthPort {
  private session: AuthSession | null;

  public constructor({ initiallyAuthenticated = true }: { initiallyAuthenticated?: boolean } = {}) {
    this.session = restorePersistedSession();
    if (!this.session && initiallyAuthenticated)
      this.session = structuredClone(DEVELOPMENT_SESSION);
  }

  public async me(): Promise<AuthSession | null> {
    return this.session ? structuredClone(this.session) : null;
  }

  public async login(input: AuthLoginInput): Promise<AuthSession> {
    if (!input.identifier.trim() || !input.password) {
      throw new Error('INVALID_CREDENTIALS');
    }

    await waitForMockLogin();
    this.session = structuredClone(DEVELOPMENT_SESSION);
    persistSession(this.session);
    return structuredClone(this.session);
  }

  public async logout(): Promise<void> {
    this.session = null;
    persistSession(null);
  }

  public async requestPasswordChange(input: AuthPasswordChangeRequestInput): Promise<void> {
    if (!input.email.trim()) throw new Error('INVALID_PASSWORD_CHANGE_EMAIL');
    await waitForMockSecurityAction();
  }
}
