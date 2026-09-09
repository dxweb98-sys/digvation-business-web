export type DeploymentProfile = 'SHARED' | 'BUSINESS_ISOLATED' | 'DEDICATED';
export type BrandingMode = 'DIGVATION_DEFAULT' | 'WHITE_LABEL';
export type ThemePreset = 'DIGVATION_LIGHT' | 'CUSTOM';
export type ThemeRadius = 'COMPACT' | 'SOFT' | 'ROUNDED';
export type ApplicationId = 'cashier' | 'backoffice';
export type BusinessProduct = 'POS';
export type BusinessCapability = 'FINANCE_OPERATIONS';

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
}

export interface RuntimeConfigPort {
  load(): Promise<RuntimeConfig>;
}
