export type DeploymentProfile = 'SHARED' | 'BUSINESS_ISOLATED' | 'DEDICATED';
export type BrandingMode = 'DIGVATION_DEFAULT' | 'WHITE_LABEL';
export type ThemePreset = 'DIGVATION_LIGHT' | 'CUSTOM';
export type ThemeRadius = 'COMPACT' | 'SOFT' | 'ROUNDED';
export type ApplicationId = 'cashier' | 'backoffice';
export type BusinessProduct = 'POS';
export type BusinessCapability =
  | 'FINANCE_OPERATIONS'
  | 'BUSINESS_ANALYTICS'
  | 'WORKFORCE_ATTENDANCE'
  | 'MEMBERSHIP'
  | 'LOYALTY_POINTS'
  | 'TAX_FISCAL';
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
export type BusinessDashboardWidget =
  | 'TOP_ITEMS'
  | 'PAYMENT_MIX'
  | 'RECENT_TRANSACTIONS'
  | 'TOP_EMPLOYEES'
  | 'BUSINESS_INSIGHT';
export type BusinessReport =
  | 'business-performance'
  | 'transactions'
  | 'catalog-performance'
  | 'employee-performance'
  | 'attendance'
  | 'payments'
  | 'expenses'
  | 'cash'
  | 'settlements'
  | 'reconciliations'
  | 'tax'
  | 'locations';

export interface BrandingConfig {
  mode: BrandingMode;
  productName: string;
  companyName?: string | undefined;
  businessName?: string | undefined;
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
  cashier: boolean;
  backoffice: boolean;
}

export interface CapabilityConfig {
  notifications: boolean;
  fulfillment: boolean;
  customers: boolean;
  loyalty: boolean;
}

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

export interface EffectiveBusinessExperience {
  hiddenDashboardWidgets: readonly BusinessDashboardWidget[];
  hiddenReports: readonly BusinessReport[];
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EffectiveBusinessConfiguration {
  profile: EffectiveBusinessProfileConfiguration;
  preferences: EffectiveBusinessPreferences;
  experience: EffectiveBusinessExperience;
}

export interface RuntimeAvailabilityConfig {
  effectiveEntitlements: EffectiveEntitlementConfig;
  effectiveFoundations: readonly BusinessFoundation[];
  effectivePermissions: readonly string[];
  businessConfiguration?: EffectiveBusinessConfiguration | undefined;
}

export interface RuntimeConfig {
  apiBaseUrl: string;
  workspace: string;
  locale: string;
  currency: string;
  defaultCountry: string;
  deploymentProfile: DeploymentProfile;
  applications: ApplicationAvailabilityConfig;
  effectiveEntitlements: EffectiveEntitlementConfig;
  branding: BrandingConfig;
  theme: ThemeConfig;
  capabilities: CapabilityConfig;
  businessConfiguration?: EffectiveBusinessConfiguration | undefined;
}

export interface RuntimeConfigPort {
  load(): Promise<RuntimeConfig>;
}
