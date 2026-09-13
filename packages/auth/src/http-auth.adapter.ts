import type {
  AuthLoginInput,
  AuthPort,
  AuthRefreshResult,
  AuthSession,
  SessionEndReason,
} from './auth.types';
import { BrowserSessionClient } from './browser-session-client';

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
  private readonly sessionClient: BrowserSessionClient;

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string,
    storageNamespace = 'business-web',
  ) {
    this.sessionClient = new BrowserSessionClient(apiBaseUrl, storageNamespace);
  }

  public async me(): Promise<AuthSession | null> {
    const accessToken = this.sessionClient.getAccessToken();
    if (!accessToken) return null;
    try {
      return await this.currentUser(accessToken);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    }

    const refreshed = await this.sessionClient.refreshAccessToken();
    if (refreshed.kind !== 'refreshed') return null;
    try {
      return await this.currentUser(refreshed.accessToken);
    } catch (error) {
      if (isUnauthorized(error)) return null;
      throw error;
    }
  }

  public async login(input: AuthLoginInput): Promise<AuthSession> {
    const accessToken = await this.sessionClient.login(
      this.workspace,
      input.identifier,
      input.password,
    );
    try {
      return await this.currentUser(accessToken);
    } catch (error) {
      this.sessionClient.clearClientSession();
      throw error;
    }
  }

  public logout(): Promise<void> {
    return this.sessionClient.logout();
  }

  public async requestPasswordChange(): Promise<void> {
    throw new Error('PASSWORD_CHANGE_NOT_SUPPORTED');
  }

  public async getAccessToken(): Promise<string | null> {
    return this.sessionClient.getAccessToken();
  }

  public refreshAccessToken(): Promise<AuthRefreshResult> {
    return this.sessionClient.refreshAccessToken();
  }

  public subscribeSessionEnded(listener: (reason: SessionEndReason) => void): () => void {
    return this.sessionClient.subscribeSessionEnded(listener);
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
    options: { method: 'GET'; accessToken: string },
  ): Promise<T> {
    const headers = new Headers();
    headers.set('authorization', `Bearer ${options.accessToken}`);
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method,
      headers,
      credentials: 'include',
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success || payload.data === undefined)
      throw new AuthenticationError(response.status, payload.error?.code ?? 'AUTH_REQUEST_FAILED');
    return payload.data;
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

function isUnauthorized(error: unknown): boolean {
  return error instanceof AuthenticationError && error.status === 401;
}
