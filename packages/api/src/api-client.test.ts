import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from './api-client';

function successResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      request_id: 'api-client-test',
      timestamp: '2026-09-01T15:49:00.000Z',
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

function failureResponse(status: number, code: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: { code, message: code },
      request_id: 'api-client-test',
      timestamp: '2026-09-01T15:49:00.000Z',
    }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  );
}

describe('ApiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('preserves command headers while applying JSON transport headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: 'sale-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({ baseUrl: 'https://pos.example.test' });
    await client.post(
      '/api/v1/sales',
      { sellingLocationId: 'branch-1', currency: 'IDR' },
      { headers: { 'Idempotency-Key': 'cashier-create-sale-1' } },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get('idempotency-key')).toBe('cashier-create-sale-1');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('sends binary bodies without JSON serialization', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ catalogItemId: 'item-1' }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient({
      baseUrl: 'https://pos.example.test',
      getAccessToken: async () => 'session-token',
    });
    const body = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
      type: 'image/png',
    });

    await client.putBinary('/api/v1/catalog/items/item-1/image', body, 'image/png');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(url).toBe('https://pos.example.test/api/v1/catalog/items/item-1/image');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(body);
    expect(headers.get('content-type')).toBe('image/png');
    expect(headers.get('authorization')).toBe('Bearer session-token');
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failureResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(successResponse({ id: 'sale-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const getAccessToken = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('fresh-access')
      .mockResolvedValueOnce('fresh-access');

    const client = new ApiClient({
      baseUrl: 'https://pos.example.test',
      getAccessToken,
    });

    await expect(client.get('/api/v1/sales/sale-1')).resolves.toEqual({ id: 'sale-1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenNthCalledWith(3, true);
    const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(retryInit.headers).get('authorization')).toBe('Bearer fresh-access');
  });

  it('reuses a token already refreshed by another request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failureResponse(401, 'UNAUTHORIZED'))
      .mockResolvedValueOnce(successResponse({ id: 'sale-2' }));
    vi.stubGlobal('fetch', fetchMock);
    const getAccessToken = vi
      .fn<(forceRefresh?: boolean) => Promise<string | null>>()
      .mockResolvedValueOnce('expired-access')
      .mockResolvedValueOnce('fresh-access')
      .mockResolvedValueOnce('fresh-access');

    const client = new ApiClient({
      baseUrl: 'https://pos.example.test',
      getAccessToken,
    });

    await expect(client.get('/api/v1/sales/sale-2')).resolves.toEqual({ id: 'sale-2' });
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(getAccessToken.mock.calls.some(([forceRefresh]) => forceRefresh === true)).toBe(false);
  });

  it('does not treat 403 as session expiry or attempt refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(failureResponse(403, 'FORBIDDEN'));
    vi.stubGlobal('fetch', fetchMock);
    const getAccessToken = vi.fn().mockResolvedValue('valid-access');
    const onUnauthorized = vi.fn();

    const client = new ApiClient({
      baseUrl: 'https://pos.example.test',
      getAccessToken,
      onUnauthorized,
    });

    await expect(client.get('/api/v1/restricted')).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
