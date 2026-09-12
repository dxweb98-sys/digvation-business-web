import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAuthenticatedEntitlements } from './authenticated-runtime-context';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('authenticated runtime context', () => {
  it('preserves every registered business capability returned by the runtime', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              effectiveProducts: ['POS'],
              effectiveCapabilities: [
                'FINANCE_OPERATIONS',
                'BUSINESS_ANALYTICS',
                'WORKFORCE_ATTENDANCE',
              ],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      loadAuthenticatedEntitlements('http://127.0.0.1:4003', 'access-token'),
    ).resolves.toEqual({
      products: ['POS'],
      capabilities: [
        'FINANCE_OPERATIONS',
        'BUSINESS_ANALYTICS',
        'WORKFORCE_ATTENDANCE',
      ],
    });
  });

  it('ignores unknown capability values instead of exposing them to application access', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              effectiveProducts: ['POS'],
              effectiveCapabilities: ['WORKFORCE_ATTENDANCE', 'UNKNOWN_FEATURE'],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    await expect(
      loadAuthenticatedEntitlements('http://127.0.0.1:4003', 'access-token'),
    ).resolves.toEqual({
      products: ['POS'],
      capabilities: ['WORKFORCE_ATTENDANCE'],
    });
  });
});
