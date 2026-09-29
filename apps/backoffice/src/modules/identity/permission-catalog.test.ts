import { describe, expect, it } from 'vitest';
import type { AccessPermission } from './access-control-api';
import { groupAccessPermissions } from './permission-catalog';

const permission = (key: string, surface: AccessPermission['surface']): AccessPermission => ({
  key,
  label: { id: key, en: key },
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

  it('keeps experience context when search filters permissions', () => {
    expect(
      groupAccessPermissions([permission('sales:create', 'OPERATIONAL')], 'en', 'create'),
    ).toMatchObject([{ key: 'OPERATIONAL', modules: [{ key: 'SALES' }] }]);
  });

  it('groups the progressed-adjustment permission under Operational > Sales without special casing', () => {
    const adjust: AccessPermission = {
      ...permission('sales:adjust-progressed', 'OPERATIONAL'),
      label: {
        id: 'Sesuaikan transaksi yang sedang dikerjakan',
        en: 'Adjust in-progress transactions',
      },
      order: 35,
    };
    const groups = groupAccessPermissions(
      [permission('sales:update', 'OPERATIONAL'), adjust],
      'en',
      '',
    );
    expect(groups).toMatchObject([{ key: 'OPERATIONAL', modules: [{ key: 'SALES' }] }]);
    expect(groups[0]?.modules[0]?.permissions.map(({ key }) => key)).toEqual([
      'sales:update',
      'sales:adjust-progressed',
    ]);
    // It stays searchable by its business label and by its canonical code.
    expect(groupAccessPermissions([adjust], 'en', 'in-progress')).toHaveLength(1);
    expect(groupAccessPermissions([adjust], 'id', 'sedang dikerjakan')).toHaveLength(1);
  });
});
