export interface OperationalSelfProfile {
  id: string;
  username: string | null;
  displayName: string;
  phoneE164: string;
  email: string | null;
  emailVerifiedAt: string | null;
  roles: Array<{ id: string; code: string; name: string; systemKey: 'OWNER' | null }>;
}

export class OperationalProfileApi {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly getAccessToken: () => Promise<string | null>,
  ) {}

  getSelf() {
    return this.request<OperationalSelfProfile>('/api/v1/auth/me', 'GET');
  }
  updateSelf(input: { displayName?: string; username?: string; email?: string | null }) {
    return this.request<OperationalSelfProfile>('/api/v1/auth/me', 'PATCH', input);
  }
  requestEmailVerification() {
    return this.request('/api/v1/auth/email-verification/request', 'POST', {});
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'PATCH' | 'POST',
    body?: unknown,
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = (await response.json()) as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    };
    if (!response.ok || !payload.success || payload.data === undefined)
      throw new OperationalProfileError(
        payload.error?.code ?? 'PROFILE_REQUEST_FAILED',
        payload.error?.message ?? 'Profile request failed.',
      );
    return payload.data;
  }
}

export class OperationalProfileError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
