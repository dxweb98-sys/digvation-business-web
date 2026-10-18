import { describe, expect, it } from 'vitest';

import type { AccessPermission } from '../access-control-api';
import {
  configurableKeys,
  permissionCategories,
  sameSelection,
  selectedIn,
} from './permission-navigation';

const permission = (
  key: string,
  area: string,
  surface: AccessPermission['surface'],
  label = key,
): AccessPermission => ({
  key,
  label: { id: label, en: label },
  product: 'POS',
  capability: null,
  foundation: null,
  section: { key: 'POS', label: { id: 'POS', en: 'POS' }, order: 10 },
  businessArea: { key: area, label: { id: area, en: area }, order: area === 'SALES' ? 10 : 20 },
  surface,
  configurable: true,
  order: 10,
});

const catalog = [
  permission('sales:read', 'SALES', 'BOTH', 'View sales'),
  permission('sales:create', 'SALES', 'OPERATIONAL', 'Create sale'),
  permission('users:read', 'USERS', 'BACKOFFICE', 'View users'),
];

describe('permissionCategories', () => {
  it('lists one category per business area and experience, keeping permission keys', () => {
    const categories = permissionCategories(catalog, 'en');
    expect(categories.map((item) => item.key)).toEqual([
      'BACKOFFICE:SALES',
      'BACKOFFICE:USERS',
      'OPERATIONAL:SALES',
    ]);
    expect(categories[2]?.permissions.map((item) => item.key)).toEqual([
      'sales:create',
      'sales:read',
    ]);
  });

  it('finds matches across categories by label, area or key', () => {
    expect(permissionCategories(catalog, 'en', 'users').map((item) => item.key)).toEqual([
      'BACKOFFICE:USERS',
    ]);
    expect(
      permissionCategories(catalog, 'en', 'sales:').flatMap((item) =>
        item.permissions.map((entry) => entry.key),
      ),
    ).toEqual(['sales:read', 'sales:create', 'sales:read']);
  });
});

describe('selection helpers', () => {
  it('counts selected permissions per category and distinct configurable keys', () => {
    const [sales] = permissionCategories(catalog, 'en');
    expect(selectedIn(sales!, new Set(['sales:read', 'users:read']))).toBe(1);
    expect(configurableKeys(catalog)).toHaveLength(3);
  });

  it('compares selections regardless of order', () => {
    expect(sameSelection(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSelection(['a'], ['a', 'b'])).toBe(false);
  });
});
