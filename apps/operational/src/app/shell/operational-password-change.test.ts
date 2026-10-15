import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRuntimePasswordChange,
  PasswordChangeCooldownError,
  type PasswordChangeError,
} from './operational-password-change';

const port = createRuntimePasswordChange({
  apiBaseUrl: 'http://runtime.test',
  getAccessToken: () => Promise.resolve('access-token'),
});

afterEach(() => vi.unstubAllGlobals());

describe('createRuntimePasswordChange', () => {
  it('asks the Runtime to send a link with the session token and no body data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await port.requestResetLink();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://runtime.test/api/v1/auth/password-change/request');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer access-token');
    expect(init.body).toBe('{}');
  });

  it('reports a cooldown distinctly from other failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: { code: 'PASSWORD_RESET_COOLDOWN' } }),
      }),
    );
    await expect(port.requestResetLink()).rejects.toBeInstanceOf(PasswordChangeCooldownError);
  });

  it('fails without claiming success when the Runtime is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(port.requestResetLink()).rejects.toThrow('PASSWORD_CHANGE_REQUEST_FAILED');
  });

  it('changes the password with the current one through the dedicated endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await port.changePassword({
      currentPassword: 'Current-Pass-1',
      newPassword: 'Another-Pass-22',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://runtime.test/api/v1/auth/change-password');
    expect(JSON.parse(String(init.body))).toEqual({
      currentPassword: 'Current-Pass-1',
      newPassword: 'Another-Pass-22',
    });
  });

  it('separates a wrong current password from an ended session and other failures', async () => {
    const answer = (status: number, code: string) =>
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: () => Promise.resolve({ error: { code } }),
      });
    const reason = async (status: number, code: string) => {
      vi.stubGlobal('fetch', answer(status, code));
      try {
        await port.changePassword({ currentPassword: 'a', newPassword: 'b' });
      } catch (error) {
        return (error as PasswordChangeError).reason;
      }
      return 'none';
    };
    expect(await reason(401, 'INVALID_CREDENTIALS')).toBe('incorrect');
    expect(await reason(401, 'AUTH_SESSION_INVALID')).toBe('session');
    expect(await reason(400, 'PASSWORD_POLICY_VIOLATION')).toBe('policy');
    expect(await reason(429, 'AUTH_THROTTLED')).toBe('throttled');
    expect(await reason(500, 'INTERNAL')).toBe('failed');
  });
});
