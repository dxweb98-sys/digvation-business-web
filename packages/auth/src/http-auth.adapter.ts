import type { AuthLoginInput, AuthPort, AuthSession } from './auth.types';

interface Credentials {
  accessToken: string;
  refreshToken: string;
}
interface AuthUser {
  id: string;
  displayName: string;
  roles: Array<{ permissions: string[] }>;
}
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string };
}

/** Browser adapter for authenticated Business Web experiences. */
export class HttpAuthAdapter implements AuthPort {
  private readonly storageKey: string;
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string,
    storageNamespace = 'business-web',
  ) {
    this.storageKey = `digvation.${storageNamespace}.auth-session.v1`;
  }
  public async me(): Promise<AuthSession | null> {
    const credentials = this.readCredentials();
    if (!credentials) return null;
    try {
      return await this.currentUser(credentials.accessToken);
    } catch (error) {
      if (!isAuthenticationFailure(error)) throw error;
    }
    try {
      const refreshed = await this.request<Credentials>('/api/v1/auth/refresh', {
        method: 'POST',
        body: { refreshToken: credentials.refreshToken },
      });
      this.writeCredentials(refreshed);
      return await this.currentUser(refreshed.accessToken);
    } catch (error) {
      this.clearCredentials();
      if (isAuthenticationFailure(error)) return null;
      throw error;
    }
  }
  public async login(input: AuthLoginInput): Promise<AuthSession> {
    const credentials = await this.request<Credentials>('/api/v1/auth/login', {
      method: 'POST',
      body: { workspace: this.workspace, identifier: input.identifier, password: input.password },
    });
    this.writeCredentials(credentials);
    try {
      return await this.currentUser(credentials.accessToken);
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
      /* local logout is complete */
    }
  }
  public async requestPasswordChange(): Promise<void> {
    throw new Error('PASSWORD_CHANGE_NOT_SUPPORTED');
  }
  public async getAccessToken(): Promise<string | null> {
    return this.readCredentials()?.accessToken ?? null;
  }
  private async currentUser(accessToken: string): Promise<AuthSession> {
    const user = await this.request<AuthUser>('/api/v1/auth/me', { method: 'GET', accessToken });
    return {
      identity: {
        userId: user.id,
        displayName: user.displayName,
        workspace: this.workspace,
        permissions: [...new Set(['auth:self', ...user.roles.flatMap((role) => role.permissions)])],
      },
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
    if (!response.ok || !payload.success || payload.data === undefined)
      throw new AuthenticationError(response.status, payload.error?.code ?? 'AUTH_REQUEST_FAILED');
    return payload.data;
  }
  private readCredentials(): Credentials | null {
    try {
      const raw = window.sessionStorage.getItem(this.storageKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      return isCredentials(value) ? value : null;
    } catch {
      return null;
    }
  }
  private writeCredentials(credentials: Credentials) {
    window.sessionStorage.setItem(this.storageKey, JSON.stringify(credentials));
  }
  private clearCredentials() {
    window.sessionStorage.removeItem(this.storageKey);
  }
}
class AuthenticationError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof AuthenticationError && (error.status === 401 || error.status === 403);
}
function isCredentials(value: unknown): value is Credentials {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Credentials).accessToken === 'string' &&
    typeof (value as Credentials).refreshToken === 'string'
  );
}
