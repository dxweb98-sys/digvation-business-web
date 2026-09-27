import { describe, expect, it } from 'vitest';

import {
  PRESENTATION_BUNDLES,
  isPresentationPreset,
  resolvePresentationBundle,
  resolvePresentationPreset,
} from './presentation';

describe('presentation registry', () => {
  it('resolves the DEFAULT bundle exactly', () => {
    expect(PRESENTATION_BUNDLES.DEFAULT).toEqual({
      appearance: 'DEFAULT',
      motion: 'DEFAULT',
      loginLayout: 'DEFAULT',
      shellLayout: 'DEFAULT',
      splash: 'DEFAULT',
    });
  });

  it('resolves the AEGIS bundle exactly', () => {
    expect(PRESENTATION_BUNDLES.AEGIS).toEqual({
      appearance: 'AEGIS',
      motion: 'ASSERTIVE',
      loginLayout: 'FOCUSED',
      shellLayout: 'FOCUSED',
      splash: 'IMMERSIVE',
    });
  });

  it('never introduces a product-named preset value', () => {
    const values = Object.values(PRESENTATION_BUNDLES).flatMap((bundle) => Object.values(bundle));
    for (const value of values) {
      expect(value).not.toMatch(/WORKSHOP|AUTOMOTIVE|POS|FNB|SALON|RETAIL/i);
    }
  });

  it('isPresentationPreset accepts only DEFAULT and AEGIS', () => {
    expect(isPresentationPreset('DEFAULT')).toBe(true);
    expect(isPresentationPreset('AEGIS')).toBe(true);
    expect(isPresentationPreset('FOCUSED')).toBe(false);
    expect(isPresentationPreset(undefined)).toBe(false);
    expect(isPresentationPreset(null)).toBe(false);
    expect(isPresentationPreset('WORKSHOP')).toBe(false);
  });

  it('resolvePresentationPreset falls back to DEFAULT for absent/unknown input', () => {
    expect(resolvePresentationPreset(undefined)).toBe('DEFAULT');
    expect(resolvePresentationPreset(null)).toBe('DEFAULT');
    expect(resolvePresentationPreset('unsupported-future-value')).toBe('DEFAULT');
    expect(resolvePresentationPreset('AEGIS')).toBe('AEGIS');
  });

  it('resolvePresentationBundle falls back to the DEFAULT bundle for absent/unknown input', () => {
    expect(resolvePresentationBundle(undefined)).toBe(PRESENTATION_BUNDLES.DEFAULT);
    expect(resolvePresentationBundle('garbage')).toBe(PRESENTATION_BUNDLES.DEFAULT);
    expect(resolvePresentationBundle('AEGIS')).toBe(PRESENTATION_BUNDLES.AEGIS);
  });
});
