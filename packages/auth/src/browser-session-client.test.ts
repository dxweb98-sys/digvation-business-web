/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserSessionClient } from './browser-session-client';

const prefix = 'digvation.operational.auth-session.v2';

function sessionResponse(accessToken = 'fresh-access'): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        accessToken,
        accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function failureResponse(status: number): Response {
  return new Response(JSON.stringify({ success: false, error: { code: 'AUTH_SESSION_INVALID' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function seedActiveSession(): void {
  window.sessionStorage.setItem(`${prefix}.access-token`, 'expired-access');
  window.sessionStorage.setItem(
    `${prefix}.access-expires-at`,
    new Date(Date.now() - 1000).toISOString(),
  );
  window.sessionStorage.setItem(`${prefix}.last-activity`, String(Date.now()));
}

describe('BrowserSessionClient', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses one refresh request for concurrent callers', async () => {
    seedActiveSession();
    const fetchMock = vi.fn().mockResolvedValue(sessionResponse());
    vi.stubGlobal('fetch', fetchMock);
    const client = new BrowserSessionClient('https://runtime.example.test', 'operational');

    const results = await Promise.all([
      client.refreshAccessToken(),
      client.refreshAccessToken(),
      client.refreshAccessToken(),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(results).toEqual([
      { kind: 'refreshed', accessToken: 'fresh-access' },
      { kind: 'refreshed', accessToken: 'fresh-access' },
      { kind: 'refreshed', accessToken: 'fresh-access' },
    ]);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('x-digvation-session-channel')).toBe('operational');
    client.clearClientSession();
  });

  it('ends an inactive session after one hour exactly once', () => {
    seedActiveSession();
    window.sessionStorage.setItem(
      `${prefix}.last-activity`,
      String(Date.now() - 60 * 60 * 1000 - 1),
    );
    const client = new BrowserSessionClient('https://runtime.example.test', 'operational');
    const listener = vi.fn();
    client.subscribeSessionEnded(listener);

    expect(client.getAccessToken()).toBeNull();
    expect(client.getAccessToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('idle');
  });

  it('ends the session once when refresh is rejected', async () => {
    seedActiveSession();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failureResponse(401)));
    const client = new BrowserSessionClient('https://runtime.example.test', 'operational');
    const listener = vi.fn();
    client.subscribeSessionEnded(listener);

    await expect(client.refreshAccessToken()).resolves.toEqual({
      kind: 'ended',
      reason: 'invalid',
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('invalid');
    expect(client.getAccessToken()).toBeNull();
  });
});
