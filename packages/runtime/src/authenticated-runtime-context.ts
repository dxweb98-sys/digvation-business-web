import type {
  BusinessCapability,
  BusinessFoundation,
  EffectiveEntitlementConfig,
  RuntimeAvailabilityConfig,
} from './runtime-config.types';

interface RuntimeContextResponse {
  success: boolean;
  data?: {
    effectiveProducts: string[];
    effectiveCapabilities: string[];
    effectiveFoundations: string[];
    effectivePermissions: string[];
  };
}

const BUSINESS_CAPABILITIES = new Set<BusinessCapability>([
  'FINANCE_OPERATIONS',
  'BUSINESS_ANALYTICS',
  'WORKFORCE_ATTENDANCE',
  'MEMBERSHIP',
  'LOYALTY_POINTS',
  'TAX_FISCAL',
]);

const BUSINESS_FOUNDATIONS = new Set<BusinessFoundation>([
  'IDENTITY_ACCESS',
  'AUDIT_ACTIVITY',
  'ORGANIZATION_LOCATION',
  'CATALOG',
  'OPERATIONAL_ACCESS',
  'WORKFORCE',
  'CUSTOMER_IDENTITY',
]);

/** Reads the authenticated business composition resolved by Business Runtime. */
export async function loadAuthenticatedRuntimeAvailability(
  apiBaseUrl: string,
  accessToken: string,
): Promise<RuntimeAvailabilityConfig> {
  const response = await fetch(`${apiBaseUrl}/api/v1/runtime/context`, {
    headers: { authorization: `Bearer ${accessToken}` },
    credentials: 'omit',
  });
  const payload = (await response.json()) as RuntimeContextResponse;
  if (!response.ok || !payload.success || !payload.data)
    throw new Error('RUNTIME_CONTEXT_UNAVAILABLE');

  return {
    effectiveEntitlements: {
      products: payload.data.effectiveProducts.filter(
        (value): value is 'POS' => value === 'POS',
      ),
      capabilities: payload.data.effectiveCapabilities.filter(
        (value): value is BusinessCapability =>
          BUSINESS_CAPABILITIES.has(value as BusinessCapability),
      ),
    },
    effectiveFoundations: payload.data.effectiveFoundations.filter(
      (value): value is BusinessFoundation =>
        BUSINESS_FOUNDATIONS.has(value as BusinessFoundation),
    ),
    effectivePermissions: [...new Set(payload.data.effectivePermissions)],
  };
}

/** Compatibility helper for callers that only need commercial entitlements. */
export async function loadAuthenticatedEntitlements(
  apiBaseUrl: string,
  accessToken: string,
): Promise<EffectiveEntitlementConfig> {
  return (
    await loadAuthenticatedRuntimeAvailability(apiBaseUrl, accessToken)
  ).effectiveEntitlements;
}
