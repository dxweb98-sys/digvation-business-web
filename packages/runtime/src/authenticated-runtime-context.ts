import type {
  BusinessCapability,
  BusinessDashboardWidget,
  BusinessDateFormat,
  BusinessFoundation,
  BusinessLocale,
  BusinessReport,
  BusinessTimeFormat,
  EffectiveBusinessConfiguration,
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
    businessConfiguration?: {
      profile: {
        name: string;
        configured: boolean;
        version: number;
        createdAt: string | null;
        updatedAt: string | null;
      };
      preferences: {
        defaultLocale: string;
        timezone: string;
        dateFormat: string;
        timeFormat: string;
        version: number;
        createdAt: string | null;
        updatedAt: string | null;
      };
      experience: {
        hiddenDashboardWidgets: string[];
        hiddenReports: string[];
        version: number;
        createdAt: string | null;
        updatedAt: string | null;
      };
    };
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

const BUSINESS_LOCALES = new Set<BusinessLocale>(['id-ID', 'en-US']);
const BUSINESS_DATE_FORMATS = new Set<BusinessDateFormat>([
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'YYYY-MM-DD',
]);
const BUSINESS_TIME_FORMATS = new Set<BusinessTimeFormat>(['HH:mm', 'hh:mm a']);
const BUSINESS_DASHBOARD_WIDGETS = new Set<BusinessDashboardWidget>([
  'TOP_ITEMS',
  'PAYMENT_MIX',
  'RECENT_TRANSACTIONS',
  'TOP_EMPLOYEES',
  'BUSINESS_INSIGHT',
]);
const BUSINESS_REPORTS = new Set<BusinessReport>([
  'business-performance',
  'transactions',
  'catalog-performance',
  'employee-performance',
  'attendance',
  'payments',
  'expenses',
  'cash',
  'settlements',
  'reconciliations',
  'tax',
  'locations',
]);

function normalizeBusinessConfiguration(
  value: NonNullable<RuntimeContextResponse['data']>['businessConfiguration'],
): EffectiveBusinessConfiguration | undefined {
  if (!value) return undefined;
  const { profile, preferences, experience } = value;
  if (
    !profile.name.trim() ||
    !BUSINESS_LOCALES.has(preferences.defaultLocale as BusinessLocale) ||
    !preferences.timezone.trim() ||
    !BUSINESS_DATE_FORMATS.has(preferences.dateFormat as BusinessDateFormat) ||
    !BUSINESS_TIME_FORMATS.has(preferences.timeFormat as BusinessTimeFormat)
  )
    return undefined;
  return {
    profile: { ...profile },
    preferences: {
      ...preferences,
      defaultLocale: preferences.defaultLocale as BusinessLocale,
      dateFormat: preferences.dateFormat as BusinessDateFormat,
      timeFormat: preferences.timeFormat as BusinessTimeFormat,
    },
    experience: {
      ...experience,
      hiddenDashboardWidgets: experience.hiddenDashboardWidgets.filter(
        (item): item is BusinessDashboardWidget =>
          BUSINESS_DASHBOARD_WIDGETS.has(item as BusinessDashboardWidget),
      ),
      hiddenReports: experience.hiddenReports.filter(
        (item): item is BusinessReport =>
          BUSINESS_REPORTS.has(item as BusinessReport),
      ),
    },
  };
}

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

  const businessConfiguration = normalizeBusinessConfiguration(
    payload.data.businessConfiguration,
  );
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
    ...(businessConfiguration ? { businessConfiguration } : {}),
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
