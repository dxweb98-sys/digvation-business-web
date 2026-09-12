import type {
  BusinessCapability,
  EffectiveEntitlementConfig,
} from './runtime-config.types';

interface RuntimeContextResponse {
  success: boolean;
  data?: { effectiveProducts: string[]; effectiveCapabilities: string[] };
}

const BUSINESS_CAPABILITIES = new Set<BusinessCapability>([
  'FINANCE_OPERATIONS',
  'BUSINESS_ANALYTICS',
  'WORKFORCE_ATTENDANCE',
]);

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
    products: payload.data.effectiveProducts.filter(
      (value): value is 'POS' => value === 'POS',
    ),
    capabilities: payload.data.effectiveCapabilities.filter(
      (value): value is BusinessCapability =>
        BUSINESS_CAPABILITIES.has(value as BusinessCapability),
    ),
  };
}
