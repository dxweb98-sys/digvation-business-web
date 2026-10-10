import type { AuthRefreshResult, SessionEndReason } from './auth.types';

interface BrowserSessionResponse {
  accessToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code?: string };
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 15_000;
const ACCESS_REFRESH_LEEWAY_MS = 30_000;
const SESSION_CHANNEL_HEADER = 'X-Digvation-Session-Channel';

export class BrowserSessionClient {
  private readonly accessTokenKey: string;
  private readonly accessExpiryKey: string;
  private readonly lastActivityKey: string;
  private readonly sessionChannel: string;
  private refreshPromise: Promise<AuthRefreshResult> | null = null;
  private idleTimer: number | null = null;
  private lastRecordedActivity = 0;
  private ended = false;
  private readonly listeners = new Set<(reason: SessionEndReason) => void>();

  public constructor(
    private readonly apiBaseUrl: string,
    storageNamespace: string,
  ) {
    if (!/^[a-z0-9-]{1,32}$/.test(storageNamespace)) {
      throw new Error('INVALID_AUTH_STORAGE_NAMESPACE');
    }
    this.sessionChannel = storageNamespace;
    const prefix = `digvation.${storageNamespace}.auth-session.v2`;
    this.accessTokenKey = `${prefix}.access-token`;
    this.accessExpiryKey = `${prefix}.access-expires-at`;
    this.lastActivityKey = `${prefix}.last-activity`;
    this.installActivityTracking();
  }

  public getAccessToken(): string | null {
    const accessToken = window.sessionStorage.getItem(this.accessTokenKey);
    if (!accessToken) return null;
    if (this.hasIdleExpired()) {
      this.endSession('idle');
      return null;
    }
    return accessToken;
  }

  /**
   * Returns an access token suitable for an active request. A token that is
   * already expired (or close to expiry) is refreshed once for all concurrent
   * callers. Refreshing never counts as user activity.
   */
  public async getUsableAccessToken(): Promise<string | null> {
    const accessToken = this.getAccessToken();
    if (!accessToken) return null;
    if (!this.shouldRefreshAccessToken()) return accessToken;

    try {
      const refreshed = await this.refreshAccessToken();
      if (refreshed.kind === 'refreshed') return refreshed.accessToken;
      if (refreshed.kind === 'deferred') return accessToken;
      return null;
    } catch (error) {
      // A temporary refresh-network failure must not discard an access token
      // that is still accepted by the server.
      if (!this.isAccessTokenExpired()) return accessToken;
      throw error;
    }
  }

  /**
   * Restores a browser session from the HttpOnly refresh cookie when there was
   * meaningful activity within the one-hour idle boundary. Access tokens stay
   * tab-scoped in sessionStorage; only the non-sensitive activity timestamp is
   * shared so reload/new-tab recovery can respect the same idle policy.
   */
  public async restoreAccessToken(): Promise<string | null> {
    const accessToken = window.sessionStorage.getItem(this.accessTokenKey);
    const lastActivity = this.readLastActivity();
    if (!accessToken && lastActivity === null) return null;

    if (this.hasIdleExpired()) {
      this.endSession('idle');
      await this.revokeBrowserSessionSilently();
      return null;
    }

    if (accessToken && !this.shouldRefreshAccessToken()) return accessToken;

    try {
      // A one-time bootstrap restore is allowed while hidden. Ongoing refresh
      // calls still defer in hidden tabs, so this does not create a background loop.
      const refreshed = await this.refreshAccessToken(true);
      if (refreshed.kind === 'refreshed') return refreshed.accessToken;
      if (refreshed.kind === 'deferred') return accessToken;
      return null;
    } catch (error) {
      if (accessToken && !this.isAccessTokenExpired()) return accessToken;
      throw error;
    }
  }

  public async login(workspace: string, identifier: string, password: string): Promise<string> {
    const session = await this.request<BrowserSessionResponse>('/api/v1/auth/browser/login', {
      method: 'POST',
      body: { workspace, identifier, password },
    });
    this.acceptSession(session);
    return session.accessToken;
  }

  public async refreshAccessToken(allowHidden = false): Promise<AuthRefreshResult> {
    if (this.hasIdleExpired()) {
      this.endSession('idle');
      return { kind: 'ended', reason: 'idle' };
    }
    if (!allowHidden && document.visibilityState === 'hidden') return { kind: 'deferred' };
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.rotateBrowserSession().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  public async logout(): Promise<void> {
    this.clearClientSession();
    try {
      await this.request('/api/v1/auth/browser/logout', { method: 'POST' });
    } catch {
      // Client-side logout is complete even if revocation cannot be confirmed over the network.
    }
  }

  public clearClientSession(): void {
    this.ended = false;
    window.sessionStorage.removeItem(this.accessTokenKey);
    window.sessionStorage.removeItem(this.accessExpiryKey);
    window.sessionStorage.removeItem(this.lastActivityKey);
    window.localStorage.removeItem(this.lastActivityKey);
    this.clearIdleTimer();
  }

  public subscribeSessionEnded(listener: (reason: SessionEndReason) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public markActivity(): void {
    if (!window.sessionStorage.getItem(this.accessTokenKey)) return;
    if (document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (now - this.lastRecordedActivity < ACTIVITY_THROTTLE_MS) return;
    this.lastRecordedActivity = now;
    window.localStorage.setItem(this.lastActivityKey, String(now));
    this.scheduleIdleCheck();
  }

  private async rotateBrowserSession(): Promise<AuthRefreshResult> {
    try {
      const session = await this.request<BrowserSessionResponse>('/api/v1/auth/browser/refresh', {
        method: 'POST',
      });
      this.acceptSession(session, false);
      return { kind: 'refreshed', accessToken: session.accessToken };
    } catch (error) {
      if (
        error instanceof BrowserSessionRequestError &&
        (error.status === 401 || error.status === 403)
      ) {
        this.endSession('invalid');
        return { kind: 'ended', reason: 'invalid' };
      }
      throw error;
    }
  }

  private acceptSession(session: BrowserSessionResponse, resetActivity = true): void {
    this.ended = false;
    window.sessionStorage.setItem(this.accessTokenKey, session.accessToken);
    window.sessionStorage.setItem(this.accessExpiryKey, session.accessExpiresAt);
    if (resetActivity || this.readLastActivity() === null) {
      const now = Date.now();
      this.lastRecordedActivity = now;
      window.localStorage.setItem(this.lastActivityKey, String(now));
    }
    window.sessionStorage.removeItem(this.lastActivityKey);
    this.scheduleIdleCheck();
  }

  private readLastActivity(): number | null {
    const shared = window.localStorage.getItem(this.lastActivityKey);
    if (shared !== null) {
      const value = Number(shared);
      if (Number.isFinite(value) && value > 0) return value;
      window.localStorage.removeItem(this.lastActivityKey);
    }

    // Migrate sessions created before activity timestamps became shared.
    const legacy = window.sessionStorage.getItem(this.lastActivityKey);
    if (legacy === null) return null;
    const value = Number(legacy);
    if (!Number.isFinite(value) || value <= 0) return null;
    window.localStorage.setItem(this.lastActivityKey, String(value));
    window.sessionStorage.removeItem(this.lastActivityKey);
    return value;
  }

  private hasIdleExpired(now = Date.now()): boolean {
    const lastActivity = this.readLastActivity();
    return lastActivity !== null && now - lastActivity >= IDLE_TIMEOUT_MS;
  }

  private shouldRefreshAccessToken(now = Date.now()): boolean {
    const raw = window.sessionStorage.getItem(this.accessExpiryKey);
    if (!raw) return true;
    const expiresAt = Date.parse(raw);
    return !Number.isFinite(expiresAt) || expiresAt - now <= ACCESS_REFRESH_LEEWAY_MS;
  }

  private isAccessTokenExpired(now = Date.now()): boolean {
    const raw = window.sessionStorage.getItem(this.accessExpiryKey);
    if (!raw) return true;
    const expiresAt = Date.parse(raw);
    return !Number.isFinite(expiresAt) || expiresAt <= now;
  }

  private endSession(reason: SessionEndReason, clearSharedActivity = true): void {
    if (this.ended) return;
    this.ended = true;
    window.sessionStorage.removeItem(this.accessTokenKey);
    window.sessionStorage.removeItem(this.accessExpiryKey);
    window.sessionStorage.removeItem(this.lastActivityKey);
    if (clearSharedActivity) window.localStorage.removeItem(this.lastActivityKey);
    this.clearIdleTimer();
    for (const listener of this.listeners) listener(reason);
  }

  private installActivityTracking(): void {
    const record = (event: Event) => {
      if (event.isTrusted) this.markActivity();
    };
    window.addEventListener('pointerdown', record, { passive: true });
    window.addEventListener('pointermove', record, { passive: true });
    window.addEventListener('keydown', record);
    window.addEventListener('touchstart', record, { passive: true });
    window.addEventListener('popstate', record);
    window.addEventListener('hashchange', record);
    window.addEventListener('storage', (event) => {
      if (event.key !== this.lastActivityKey || event.storageArea !== window.localStorage) return;
      if (event.newValue === null) {
        if (window.sessionStorage.getItem(this.accessTokenKey)) this.endSession('invalid', false);
        return;
      }
      this.scheduleIdleCheck();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.clearIdleTimer();
        return;
      }
      if (this.hasIdleExpired()) {
        this.endSession('idle');
        return;
      }
      this.scheduleIdleCheck();
    });
    this.scheduleIdleCheck();
  }

  private scheduleIdleCheck(): void {
    this.clearIdleTimer();
    if (document.visibilityState === 'hidden') return;
    if (!window.sessionStorage.getItem(this.accessTokenKey)) return;
    const lastActivity = this.readLastActivity();
    if (lastActivity === null) return;
    const remaining = Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivity));
    this.idleTimer = window.setTimeout(() => {
      if (this.hasIdleExpired()) this.endSession('idle');
      else this.scheduleIdleCheck();
    }, remaining);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer === null) return;
    window.clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private async revokeBrowserSessionSilently(): Promise<void> {
    try {
      await this.request('/api/v1/auth/browser/logout', { method: 'POST' });
    } catch {
      // The local one-hour idle boundary is authoritative even while offline.
    }
  }

  private async request<T>(path: string, options: { method: 'POST'; body?: unknown }): Promise<T> {
    const headers = new Headers();
    headers.set(SESSION_CHANNEL_HEADER, this.sessionChannel);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: options.method,
      headers,
      credentials: 'include',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success || payload.data === undefined) {
      throw new BrowserSessionRequestError(
        response.status,
        payload.error?.code ?? 'AUTH_REQUEST_FAILED',
      );
    }
    return payload.data;
  }
}

export class BrowserSessionRequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
