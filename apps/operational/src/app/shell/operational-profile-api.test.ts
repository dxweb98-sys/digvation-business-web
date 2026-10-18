import { afterEach, describe, expect, it, vi } from 'vitest';

import { OperationalProfileApi } from './operational-profile-api';

afterEach(() => vi.unstubAllGlobals());

describe('OperationalProfileApi', () => {
  it('uses the authenticated Runtime self-service endpoints for email and verification', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: 'u-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const api = new OperationalProfileApi('http://runtime.test', () =>
      Promise.resolve('access-token'),
    );
    await api.updateSelf({ email: 'operator@example.com' });
    await api.requestEmailVerification();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://runtime.test/api/v1/auth/me');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: 'PATCH',
      headers: expect.objectContaining({ authorization: 'Bearer access-token' }),
    });
    expect(fetchMock.mock.calls[1]![0]).toBe(
      'http://runtime.test/api/v1/auth/email-verification/request',
    );
  });
});
