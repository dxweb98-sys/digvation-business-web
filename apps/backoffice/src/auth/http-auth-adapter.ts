import {
  BrowserSessionClient,
  type AuthRefreshResult,
  type SessionEndReason,
} from '@digvation/business-auth';
import { loadAuthenticatedRuntimeAvailability } from '@digvation/business-runtime';
import type { BackofficeSession, LoginCredentials } from './auth-session';

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

export class HttpAuthAdapter {
  private readonly sessionClient: BrowserSessionClient;

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string,
  ) {
    this.sessionClient = new BrowserSessionClient(apiBaseUrl, 'backoffice');
  }

  public async restore(): Promise<BackofficeSession | null> {
    const accessToken = await this.sessionClient.restoreAccessToken();
    if (!accessToken) return null;

    try {
      return await this.getCurrentUser(accessToken);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    }

    const refreshed = await this.sessionClient.refreshAccessToken();
    if (refreshed.kind !== 'refreshed') return null;

    try {
      return await this.getCurrentUser(refreshed.accessToken);
    } catch (error) {
      if (isUnauthorized(error)) return null;
      throw error;
    }
  }

  public async login(input: LoginCredentials): Promise<BackofficeSession> {
    const accessToken = await this.sessionClient.login(
      input.workspace,
      input.identifier,
      input.password,
    );

    try {
      return await this.getCurrentUser(accessToken, input.workspace);
    } catch (error) {
      this.sessionClient.clearClientSession();
      throw error;
    }
  }

  public logout(): Promise<void> {
    return this.sessionClient.logout();
  }

  public async getAccessToken(forceRefresh = false): Promise<string | null> {
    if (!forceRefresh) return this.sessionClient.getUsableAccessToken();
    const refreshed = await this.sessionClient.refreshAccessToken();
    if (refreshed.kind === 'refreshed') return refreshed.accessToken;
    if (refreshed.kind === 'deferred') return this.sessionClient.getAccessToken();
    return null;
  }

  public refreshAccessToken(): Promise<AuthRefreshResult> {
    return this.sessionClient.refreshAccessToken();
  }

  public subscribeSessionEnded(listener: (reason: SessionEndReason) => void): () => void {
    return this.sessionClient.subscribeSessionEnded(listener);
  }

  private async getCurrentUser(
    accessToken: string,
    workspace = this.workspace,
  ): Promise<BackofficeSession> {
    const user = await this.request<AuthUserResponse>('/api/v1/auth/me', {
      method: 'GET',
      accessToken,
    });
    const roles = user.roles.map(({ id, code, name, systemKey }) => ({
      id,
      code,
      name,
      systemKey,
    }));
    const availability = await loadAuthenticatedRuntimeAvailability(this.apiBaseUrl, accessToken);

    return {
      identity: {
        userId: user.id,
        displayName: user.displayName,
        workspace,
        permissions: availability.effectivePermissions,
        roles,
      },
      effectiveEntitlements: availability.effectiveEntitlements,
      effectiveFoundations: availability.effectiveFoundations,
      ...(availability.businessConfiguration
        ? { businessConfiguration: availability.businessConfiguration }
        : {}),
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
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new AuthenticationError(
        response.status,
        payload.error?.code ?? 'AUTH_REQUEST_FAILED',
        payload.error?.message ?? 'Authentication request failed.',
      );
    }
    return payload.data;
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

function isUnauthorized(error: unknown): boolean {
  return error instanceof AuthenticationError && error.status === 401;
}
