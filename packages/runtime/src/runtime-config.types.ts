export type DeploymentProfile = 'SHARED' | 'BUSINESS_ISOLATED' | 'DEDICATED';
export type BrandingMode = 'DIGVATION_DEFAULT' | 'WHITE_LABEL';
export type ThemePreset = 'DIGVATION_LIGHT' | 'CUSTOM';
export type ThemeRadius = 'COMPACT' | 'SOFT' | 'ROUNDED';
export type ApplicationId = 'operational' | 'backoffice';
export type BusinessProduct = 'POS';
export type BusinessCapability =
  | 'FINANCE_OPERATIONS'
  | 'BUSINESS_ANALYTICS'
  | 'WORKFORCE_ATTENDANCE'
  | 'MEMBERSHIP'
  | 'LOYALTY_POINTS'
  | 'TAX_FISCAL'
  | 'PROMOTIONS';
export type BusinessFoundation =
  | 'IDENTITY_ACCESS'
  | 'AUDIT_ACTIVITY'
  | 'ORGANIZATION_LOCATION'
  | 'CATALOG'
  | 'OPERATIONAL_ACCESS'
  | 'WORKFORCE'
  | 'CUSTOMER_IDENTITY';
export type BusinessLocale = 'id-ID' | 'en-US';
export type BusinessDateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type BusinessTimeFormat = 'HH:mm' | 'hh:mm a';

export interface BrandingConfig {
  mode: BrandingMode;
  productName: string;
  companyName?: string | undefined;
  logoUrl?: string | undefined;
}

export interface ThemeColorConfig {
  background?: string | undefined;
  surface?: string | undefined;
  surfaceMuted?: string | undefined;
  text?: string | undefined;
  textMuted?: string | undefined;
  border?: string | undefined;
  brand?: string | undefined;
  focus?: string | undefined;
  accentYellow?: string | undefined;
  accentMint?: string | undefined;
  accentSky?: string | undefined;
  accentLavender?: string | undefined;
  accentCoral?: string | undefined;
}

export interface ThemeConfig {
  preset: ThemePreset;
  radius: ThemeRadius;
  colors?: ThemeColorConfig | undefined;
}

export interface ApplicationAvailabilityConfig {
  operational: boolean;
  backoffice: boolean;
}

export type WorkspaceResolutionConfig =
  | Readonly<{
      mode: 'FIXED';
      workspace: string;
    }>
  | Readonly<{
      mode: 'LOGIN';
      defaultWorkspace?: string | undefined;
    }>;

export interface DeploymentBootstrapDefaults {
  locale: BusinessLocale;
  country: string;
}

export interface DeploymentBootstrapConfig {
  /**
   * API origin used before authentication. Empty string means same-origin and
   * keeps the existing /api/v1 request paths unchanged.
   */
  apiBaseUrl: string;
  deploymentProfile: DeploymentProfile;
  workspaceResolution: WorkspaceResolutionConfig;
  applications: ApplicationAvailabilityConfig;
  branding: BrandingConfig;
  theme: ThemeConfig;
  defaults: DeploymentBootstrapDefaults;
}

export interface DeploymentBootstrapConfigPort {
  load(): Promise<DeploymentBootstrapConfig>;
}

/**
 * Compile-time vocabulary mirrors the Runtime contract only. These values are
 * never a browser-side entitlement authority.
 */
export interface EffectiveEntitlementConfig {
  products: readonly BusinessProduct[];
  capabilities: readonly BusinessCapability[];
}

export interface EffectiveBusinessProfileConfiguration {
  name: string;
  configured: boolean;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EffectiveBusinessPreferences {
  defaultLocale: BusinessLocale;
  timezone: string;
  dateFormat: BusinessDateFormat;
  timeFormat: BusinessTimeFormat;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EffectiveBusinessConfiguration {
  profile: EffectiveBusinessProfileConfiguration;
  preferences: EffectiveBusinessPreferences;
}

/**
 * Minimal authenticated data needed to project the former `useRuntime()` view.
 * Applications pass their canonical AuthSession structurally; this package does
 * not fetch, cache, or calculate authenticated access itself.
 */
export interface AuthenticatedRuntimeProjection {
  readonly business: {
    readonly name: string;
    readonly currency: string;
  };
  readonly access: {
    readonly products: readonly string[];
    readonly capabilities: readonly string[];
    readonly foundations: readonly string[];
    readonly permissions: readonly string[];
  };
  readonly preferences: {
    readonly locale: string;
    readonly timezone: string;
    readonly dateFormat: string;
    readonly timeFormat: string;
  };
  readonly contextVersion: string;
}
