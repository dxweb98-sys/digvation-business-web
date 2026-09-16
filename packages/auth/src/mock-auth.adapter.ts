import type {
  AuthLoginInput,
  AuthPasswordChangeRequestInput,
  AuthPort,
  AuthSession,
} from './auth.types';

const MOCK_LOGIN_LATENCY_MS = 850;
const MOCK_SECURITY_LATENCY_MS = 500;

const DEVELOPMENT_SESSION: AuthSession = {
  identity: {
    userId: 'demo-operator',
    displayName: 'Demo Operator',
    username: 'demo',
    roles: [],
  },
  business: {
    tenantId: '00000000-0000-4000-8000-000000000001',
    name: 'Local Development',
  },
  access: {
    products: ['POS'],
    capabilities: [],
    foundations: ['IDENTITY_ACCESS', 'AUDIT_ACTIVITY', 'ORGANIZATION_LOCATION', 'CATALOG', 'OPERATIONAL_ACCESS'],
    permissions: ['auth:self', 'sales:read', 'sales:create'],
  },
  preferences: {
    locale: 'id-ID',
    timezone: 'Asia/Jakarta',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  deployment: {
    profile: 'SHARED',
  },
  contextVersion: 'mock-development-context',
};

function waitForMockLogin() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, MOCK_LOGIN_LATENCY_MS));
}

function waitForMockSecurityAction() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, MOCK_SECURITY_LATENCY_MS));
}

export class MockAuthAdapter implements AuthPort {
  private session: AuthSession | null;

  public constructor({ initiallyAuthenticated = true }: { initiallyAuthenticated?: boolean } = {}) {
    this.session = initiallyAuthenticated ? structuredClone(DEVELOPMENT_SESSION) : null;
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
    return structuredClone(this.session);
  }

  public async logout(): Promise<void> {
    this.session = null;
  }

  public async refreshSessionContext(): Promise<AuthSession | null> {
    return this.me();
  }

  public async requestPasswordChange(input: AuthPasswordChangeRequestInput): Promise<void> {
    if (!input.email.trim()) throw new Error('INVALID_PASSWORD_CHANGE_EMAIL');
    await waitForMockSecurityAction();
  }
}
