import type {
  EffectiveBusinessConfiguration,
  RuntimeConfig,
} from './runtime-config.types';

/**
 * Applies authenticated tenant configuration over deployment bootstrap values.
 * Runtime config remains the fallback only when the tenant has no hydrated value.
 */
export function applyEffectiveBusinessConfiguration(
  runtime: RuntimeConfig,
  configuration: EffectiveBusinessConfiguration | undefined,
): RuntimeConfig {
  if (!configuration) return runtime;
  return {
    ...runtime,
    locale: configuration.preferences.defaultLocale,
    branding: {
      ...runtime.branding,
      businessName:
        configuration.profile.name.trim() || runtime.branding.businessName,
    },
    businessConfiguration: configuration,
  };
}
