import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from './auth.types';
import { HttpAuthAdapter } from './http-auth.adapter';

const SESSION: AuthSession = {
  identity: {
    userId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Operator',
    username: 'operator',
    roles: [{ id: '22222222-2222-4222-8222-222222222222', code: 'OPERATOR', name: 'Operator', systemKey: null }],
  },
  business: {
    tenantId: '33333333-3333-4333-8333-333333333333',
    name: 'DGV Salon',
    currency: 'IDR',
  },
  access: {
    products: ['POS'],
    capabilities: [],
    foundations: ['IDENTITY_ACCESS', 'OPERATIONAL_ACCESS'],
    permissions: ['auth:self', 'sales:create'],
  },
  preferences: {
    locale: 'id-ID',
    timezone: 'Asia/Jakarta',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  deployment: { profile: 'DEDICATED' },
  contextVersion: 'context-v1',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('HttpAuthAdapter session hydration', () => {
  it('hydrates login through browser login then one canonical session-context request', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            accessToken: 'access-token',
            accessExpiresAt: '2099-01-01T00:00:00.000Z',
            refreshExpiresAt: '2099-02-01T00:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: SESSION }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new HttpAuthAdapter('https://runtime.test', 'workspace-a', 'operational');
    await expect(
      adapter.login({ identifier: 'operator', password: 'secret' }),
    ).resolves.toEqual(SESSION);

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual([
      'https://runtime.test/api/v1/auth/browser/login',
      'https://runtime.test/api/v1/session/context',
    ]);
    expect(urls.some((url) => url.includes('/auth/me'))).toBe(false);
    expect(urls.some((url) => url.includes('/runtime/context'))).toBe(false);
  });

  it('fails closed when canonical session context is unavailable after login', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            accessToken: 'access-token',
            accessExpiresAt: '2099-01-01T00:00:00.000Z',
            refreshExpiresAt: '2099-02-01T00:00:00.000Z',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: { code: 'SESSION_CONTEXT_UNAVAILABLE' } },
          503,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new HttpAuthAdapter('https://runtime.test', 'workspace-a', 'backoffice');
    await expect(
      adapter.login({ identifier: 'operator', password: 'secret' }),
    ).rejects.toMatchObject({ status: 503, code: 'SESSION_CONTEXT_UNAVAILABLE' });

    expect(window.sessionStorage.length).toBe(0);
  });

  it('requires explicit workspace resolution before authentication when no default exists', async () => {
    const adapter = new HttpAuthAdapter('https://runtime.test', undefined, 'backoffice');
    await expect(
      adapter.login({ identifier: 'operator', password: 'secret' }),
    ).rejects.toThrow('AUTH_WORKSPACE_REQUIRED');
  });
});
