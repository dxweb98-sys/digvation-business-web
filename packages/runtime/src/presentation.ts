/**
 * Cross-product presentation foundation (DIG-59). PresentationPreset is the
 * only client-facing/persisted selection; every other dimension is resolved
 * from the finite bundle registry below. Presentation never grants or infers
 * products, capabilities, permissions, or location access.
 */
export type PresentationPreset = 'DEFAULT' | 'AEGIS';
export type AppearancePreset = 'DEFAULT' | 'AEGIS';
export type MotionPreset = 'DEFAULT' | 'ASSERTIVE';
export type LoginLayoutPreset = 'DEFAULT' | 'FOCUSED';
export type ShellLayoutPreset = 'DEFAULT' | 'FOCUSED';
export type SplashPreset = 'DEFAULT' | 'IMMERSIVE';

export interface PresentationBundle {
  appearance: AppearancePreset;
  motion: MotionPreset;
  loginLayout: LoginLayoutPreset;
  shellLayout: ShellLayoutPreset;
  splash: SplashPreset;
}

const DEFAULT_PRESENTATION_BUNDLE: PresentationBundle = {
  appearance: 'DEFAULT',
  motion: 'DEFAULT',
  loginLayout: 'DEFAULT',
  shellLayout: 'DEFAULT',
  splash: 'DEFAULT',
};

const AEGIS_PRESENTATION_BUNDLE: PresentationBundle = {
  appearance: 'AEGIS',
  motion: 'ASSERTIVE',
  loginLayout: 'FOCUSED',
  shellLayout: 'FOCUSED',
  splash: 'IMMERSIVE',
};

/**
 * The single finite registry. New presets are added here only — never as
 * scattered `if (preset === 'AEGIS')` branches through application code.
 */
export const PRESENTATION_BUNDLES: Readonly<Record<PresentationPreset, PresentationBundle>> = {
  DEFAULT: DEFAULT_PRESENTATION_BUNDLE,
  AEGIS: AEGIS_PRESENTATION_BUNDLE,
};

export function isPresentationPreset(value: unknown): value is PresentationPreset {
  return value === 'DEFAULT' || value === 'AEGIS';
}

/** Absent/unrecognized input always resolves to DEFAULT — never a write-on-read, never a throw. */
export function resolvePresentationPreset(value: unknown): PresentationPreset {
  return isPresentationPreset(value) ? value : 'DEFAULT';
}

export function resolvePresentationBundle(preset: unknown): PresentationBundle {
  return PRESENTATION_BUNDLES[resolvePresentationPreset(preset)];
}
