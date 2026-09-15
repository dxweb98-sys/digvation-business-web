import { describe, expect, it } from 'vitest';

import { resolveBackofficeLocale } from './backoffice-localization';

describe('resolveBackofficeLocale', () => {
  it('uses English when runtime configuration is en-US', () => {
    expect(resolveBackofficeLocale('en-US')).toBe('en');
  });

  it('uses Indonesian when runtime configuration is id-ID', () => {
    expect(resolveBackofficeLocale('id-ID')).toBe('id');
  });

  it('defaults unknown locale values to Indonesian', () => {
    expect(resolveBackofficeLocale('unknown')).toBe('id');
  });
});
