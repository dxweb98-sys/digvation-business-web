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

export class BrowserSessionClient {
  private readonly accessTokenKey: string;
  private readonly accessExpiryKey: string;
  private readonly lastActivityKey: string;
  private refreshPromise: Promise<AuthRefreshResult> | null = null;
  private idleTimer: number | null = null;
  private lastRecordedActivity = 0;
  private ended = false;
  private readonly listeners = new Set<(reason: SessionEndReason) => void>();

  public constructor(
    private readonly apiBaseUrl: string,
    storageNamespace: string,
  ) {
    const prefix = `digvation.${storageNamespace}.auth-session.v2`;
    this.accessTokenKey = `${prefix}.access-token`;
    this.accessExpiryKey = `${prefix}.access-expires-at`;
    this.lastActivityKey = `${prefix}.last-activity`;
    this.installActivityTracking();
  }

  public getAccessToken(): string | null {
    if (this.hasIdleExpired()) {
      this.endSession('idle');
      return null;
    }
    return window.sessionStorage.getItem(this.accessTokenKey);
  }

  public async login(
    workspace: string,
    identifier: string,
    password: string,
  ): Promise<string> {
    const session = await this.request<BrowserSessionResponse>('/api/v1/auth/browser/login', {
      method: 'POST',
      body: { workspace, identifier, password },
    });
    this.acceptSession(session);
    return session.accessToken;
  }

  public async refreshAccessToken(): Promise<AuthRefreshResult> {
    if (this.hasIdleExpired()) {
      this.endSession('idle');
      return { kind: 'ended', reason: 'idle' };
    }
    if (document.visibilityState === 'hidden') return { kind: 'deferred' };
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
    window.sessionStorage.setItem(this.lastActivityKey, String(now));
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
      if (error instanceof BrowserSessionRequestError && error.status === 401) {
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
    if (resetActivity || !window.sessionStorage.getItem(this.lastActivityKey)) {
      const now = Date.now();
      this.lastRecordedActivity = now;
      window.sessionStorage.setItem(this.lastActivityKey, String(now));
    }
    this.scheduleIdleCheck();
  }

  private hasIdleExpired(now = Date.now()): boolean {
    const token = window.sessionStorage.getItem(this.accessTokenKey);
    if (!token) return false;
    const raw = window.sessionStorage.getItem(this.lastActivityKey);
    const lastActivity = raw ? Number(raw) : 0;
    return !Number.isFinite(lastActivity) || lastActivity <= 0 || now - lastActivity >= IDLE_TIMEOUT_MS;
  }

  private endSession(reason: SessionEndReason): void {
    if (this.ended) return;
    this.ended = true;
    window.sessionStorage.removeItem(this.accessTokenKey);
    window.sessionStorage.removeItem(this.accessExpiryKey);
    window.sessionStorage.removeItem(this.lastActivityKey);
    this.clearIdleTimer();
    for (const listener of this.listeners) listener(reason);
  }

  private installActivityTracking(): void {
    const record = () => this.markActivity();
    window.addEventListener('pointerdown', record, { passive: true });
    window.addEventListener('pointermove', record, { passive: true });
    window.addEventListener('keydown', record);
    window.addEventListener('touchstart', record, { passive: true });
    window.addEventListener('popstate', record);
    window.addEventListener('hashchange', record);
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
    const lastActivity = Number(window.sessionStorage.getItem(this.lastActivityKey) ?? '0');
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

  private async request<T>(
    path: string,
    options: { method: 'POST'; body?: unknown },
  ): Promise<T> {
    const headers = new Headers();
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
