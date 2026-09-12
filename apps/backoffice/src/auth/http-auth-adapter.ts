import { loadAuthenticatedRuntimeAvailability } from '@digvation/business-runtime';
import type { BackofficeSession, LoginCredentials } from './auth-session';
import { effectiveBusinessPermissions } from './effective-business-permissions';

interface SessionCredentials {
  accessToken: string;
  refreshToken: string;
}

interface SessionResponse extends SessionCredentials {
  tokenType: 'Bearer';
}

interface AuthUserResponse {
  id: string;
  displayName: string;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    systemKey: string | null;
    permissions: string[];
  }>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

const SESSION_STORAGE_KEY = 'digvation.pos.backoffice.auth-session.v1';

export class HttpAuthAdapter {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string,
  ) {}

  public async restore(): Promise<BackofficeSession | null> {
    const credentials = this.readCredentials();
    if (!credentials) return null;

    try {
      return await this.getCurrentUser(credentials.accessToken);
    } catch (error) {
      if (!isAuthenticationFailure(error)) throw error;
    }

    try {
      const refreshed = await this.refresh(credentials.refreshToken);
      this.writeCredentials(refreshed);
      return await this.getCurrentUser(refreshed.accessToken);
    } catch (error) {
      this.clearCredentials();
      if (isAuthenticationFailure(error)) return null;
      throw error;
    }
  }

  public async login(input: LoginCredentials): Promise<BackofficeSession> {
    const session = await this.request<SessionResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: { workspace: input.workspace, identifier: input.identifier, password: input.password },
    });
    this.writeCredentials(session);

    try {
      return await this.getCurrentUser(session.accessToken, input.workspace);
    } catch (error) {
      this.clearCredentials();
      throw error;
    }
  }

  public async logout(): Promise<void> {
    const credentials = this.readCredentials();
    this.clearCredentials();
    if (!credentials) return;

    try {
      await this.request('/api/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken: credentials.refreshToken },
      });
    } catch {
      // Local credentials are cleared even if the network cannot confirm revocation.
    }
  }

  public async getAccessToken(): Promise<string | null> {
    return this.readCredentials()?.accessToken ?? null;
  }

  private async refresh(refreshToken: string): Promise<SessionResponse> {
    return this.request<SessionResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
  }

  private async getCurrentUser(
    accessToken: string,
    workspace = this.workspace,
  ): Promise<BackofficeSession> {
    const user = await this.request<AuthUserResponse>('/api/v1/auth/me', {
      method: 'GET',
      accessToken,
    });
    const grantedPermissions = new Set<string>(['auth:self']);
    const roles = user.roles.map(({ id, code, name, systemKey, permissions: rolePermissions }) => {
      rolePermissions.forEach((permission) => grantedPermissions.add(permission));
      return { id, code, name, systemKey };
    });

    const availability = await loadAuthenticatedRuntimeAvailability(
      this.apiBaseUrl,
      accessToken,
    );
    const permissions = effectiveBusinessPermissions(
      grantedPermissions,
      availability,
    );
    return {
      identity: {
        userId: user.id,
        displayName: user.displayName,
        workspace,
        permissions,
        roles,
      },
      effectiveEntitlements: availability.effectiveEntitlements,
      effectiveFoundations: availability.effectiveFoundations,
    };
  }

  private async request<T>(
    path: string,
    options: { method: 'GET' | 'POST'; body?: unknown; accessToken?: string },
  ): Promise<T> {
    const headers = new Headers();
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.accessToken) headers.set('authorization', `Bearer ${options.accessToken}`);

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      credentials: 'omit',
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new AuthenticationError(
        response.status,
        payload.error?.code ?? 'AUTH_REQUEST_FAILED',
        payload.error?.message ?? 'Authentication request failed.',
      );
    }
    return payload.data;
  }

  private readCredentials(): SessionCredentials | null {
    try {
      const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isSessionCredentials(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private writeCredentials(credentials: SessionCredentials): void {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credentials));
  }

  private clearCredentials(): void {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

class AuthenticationError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof AuthenticationError && (error.status === 401 || error.status === 403);
}

function isSessionCredentials(value: unknown): value is SessionCredentials {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as SessionCredentials).accessToken === 'string' &&
    typeof (value as SessionCredentials).refreshToken === 'string'
  );
}
