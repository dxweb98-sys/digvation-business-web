import type {
  AuthLoginInput,
  AuthPort,
  AuthRefreshResult,
  AuthSession,
  SessionEndReason,
} from './auth.types';
import { BrowserSessionClient } from './browser-session-client';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string; message?: string };
}

/** Browser adapter for authenticated Business Web experiences. */
export class HttpAuthAdapter implements AuthPort {
  private readonly sessionClient: BrowserSessionClient;

  public constructor(
    private readonly apiBaseUrl: string,
    private readonly workspace: string | undefined,
    storageNamespace = 'business-web',
  ) {
    this.sessionClient = new BrowserSessionClient(apiBaseUrl, storageNamespace);
  }

  public async me(): Promise<AuthSession | null> {
    const accessToken = await this.sessionClient.restoreAccessToken();
    if (!accessToken) return null;
    return this.hydrateWithSingleRefresh(accessToken);
  }

  public async login(input: AuthLoginInput): Promise<AuthSession> {
    const workspace = input.workspace ?? this.workspace;
    if (!workspace) throw new Error('AUTH_WORKSPACE_REQUIRED');

    const accessToken = await this.sessionClient.login(
      workspace,
      input.identifier,
      input.password,
    );
    try {
      return await this.currentSession(accessToken);
    } catch (error) {
      this.sessionClient.clearClientSession();
      throw error;
    }
  }

  public logout(): Promise<void> {
    return this.sessionClient.logout();
  }

  public async refreshSessionContext(): Promise<AuthSession | null> {
    const accessToken = await this.sessionClient.getUsableAccessToken();
    if (!accessToken) return null;
    return this.hydrateWithSingleRefresh(accessToken);
  }

  public async requestPasswordChange(): Promise<void> {
    throw new Error('PASSWORD_CHANGE_NOT_SUPPORTED');
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

  private async hydrateWithSingleRefresh(accessToken: string): Promise<AuthSession | null> {
    try {
      return await this.currentSession(accessToken);
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
    }

    const refreshed = await this.sessionClient.refreshAccessToken();
    if (refreshed.kind !== 'refreshed') return null;
    try {
      return await this.currentSession(refreshed.accessToken);
    } catch (error) {
      if (isUnauthorized(error)) return null;
      throw error;
    }
  }

  private currentSession(accessToken: string): Promise<AuthSession> {
    return this.request<AuthSession>('/api/v1/session/context', {
      method: 'GET',
      accessToken,
    });
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
      throw new AuthenticationError(
        response.status,
        payload.error?.code ?? 'AUTH_REQUEST_FAILED',
        payload.error?.message ?? 'Authentication request failed.',
      );
    return payload.data;
  }
}

export class AuthenticationError extends Error {
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
