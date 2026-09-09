import type { EffectiveEntitlementConfig } from './runtime-config.types';

interface RuntimeContextResponse {
  success: boolean;
  data?: { effectiveProducts: string[]; effectiveCapabilities: string[] };
}

/** Reads business availability from the authenticated backend runtime context. */
export async function loadAuthenticatedEntitlements(
  apiBaseUrl: string,
  accessToken: string,
): Promise<EffectiveEntitlementConfig> {
  const response = await fetch(`${apiBaseUrl}/api/v1/runtime/context`, {
    headers: { authorization: `Bearer ${accessToken}` },
    credentials: 'omit',
  });
  const payload = (await response.json()) as RuntimeContextResponse;
  if (!response.ok || !payload.success || !payload.data)
    throw new Error('RUNTIME_CONTEXT_UNAVAILABLE');
  return {
    products: payload.data.effectiveProducts.filter((value): value is 'POS' => value === 'POS'),
    capabilities: payload.data.effectiveCapabilities.filter(
      (value): value is 'FINANCE_OPERATIONS' => value === 'FINANCE_OPERATIONS',
    ),
  };
}
