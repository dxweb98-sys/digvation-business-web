import { describe, expect, it } from 'vitest';
import type { AccessPermission } from './access-control-api';
import { groupAccessPermissions } from './permission-catalog';

const permission = (
  key: string,
  surface: AccessPermission['surface'],
  label = { id: 'Lihat penjualan', en: 'View sales' },
): AccessPermission => ({
  key,
  label,
  product: 'POS',
  capability: null,
  foundation: null,
  section: { key: 'POS', label: { id: 'POS', en: 'POS' }, order: 10 },
  businessArea: { key: 'SALES', label: { id: 'Penjualan', en: 'Sales' }, order: 20 },
  surface,
  configurable: true,
  order: 10,
});

describe('groupAccessPermissions', () => {
  it('separates Backoffice and Operational while retaining one canonical permission code', () => {
    const groups = groupAccessPermissions(
      [
        permission('sales:read', 'BOTH'),
        permission('sales:create', 'OPERATIONAL'),
        permission('activity:read', 'BACKOFFICE'),
      ],
      'en',
      '',
    );
    expect(groups.map((group) => group.key)).toEqual(['BACKOFFICE', 'OPERATIONAL']);
    expect(groups[0]?.modules[0]?.permissions.map(({ key }) => key)).toContain('sales:read');
    expect(groups[1]?.modules[0]?.permissions.map(({ key }) => key)).toEqual([
      'sales:create',
      'sales:read',
    ]);
  });

  it('keeps human-readable permission metadata separate from the technical key', () => {
    const groups = groupAccessPermissions(
      [
        permission('membership:read', 'BACKOFFICE', {
          id: 'Lihat member',
          en: 'View members',
        }),
      ],
      'id',
      '',
    );
    expect(groups[0]?.modules[0]?.permissions[0]).toMatchObject({
      key: 'membership:read',
      label: { id: 'Lihat member', en: 'View members' },
    });
  });

  it('keeps experience context when search filters permissions', () => {
    expect(
      groupAccessPermissions([permission('sales:create', 'OPERATIONAL')], 'en', 'create'),
    ).toMatchObject([{ key: 'OPERATIONAL', modules: [{ key: 'SALES' }] }]);
  });
});
