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

  it('presents the Runtime tax:read metadata as Backoffice › Pajak, with no Web permission list', () => {
    const taxRead: AccessPermission = {
      key: 'tax:read',
      label: { id: 'Lihat laporan pajak', en: 'View tax reports' },
      product: null,
      capability: 'TAX_FISCAL',
      foundation: 'CATALOG',
      section: {
        key: 'FINANCE_OPERATIONS',
        label: { id: 'Keuangan', en: 'Finance Operations' },
        order: 30,
      },
      businessArea: { key: 'TAX', label: { id: 'Pajak', en: 'Tax' }, order: 70 },
      surface: 'BACKOFFICE',
      configurable: true,
      order: 10,
    };
    const groups = groupAccessPermissions([taxRead], 'id', '');
    expect(groups).toMatchObject([
      { key: 'BACKOFFICE', modules: [{ key: 'TAX', label: 'Pajak' }] },
    ]);
    expect(groups[0]?.modules[0]?.permissions.map(({ key }) => key)).toEqual(['tax:read']);
    expect(groupAccessPermissions([taxRead], 'id', 'laporan pajak')).toHaveLength(1);
  });
});
