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

const workshopPermission = (
  key: string,
  surface: AccessPermission['surface'],
): AccessPermission => ({
  key,
  label: { id: key, en: key },
  product: 'WORKSHOP',
  capability: null,
  foundation: null,
  section: { key: 'WORKSHOP', label: { id: 'Bengkel', en: 'Workshop' }, order: 15 },
  businessArea: {
    key: 'WORK_ORDERS',
    label: { id: 'Perintah Kerja', en: 'Work Orders' },
    order: 10,
  },
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

  it('groups Workshop BACKOFFICE, OPERATIONAL, and BOTH permissions alongside unchanged POS grouping', () => {
    const groups = groupAccessPermissions(
      [
        permission('sales:read', 'BOTH'),
        permission('sales:create', 'OPERATIONAL'),
        workshopPermission('workshop-dashboard:read', 'BACKOFFICE'),
        workshopPermission('workshop-queue:read', 'OPERATIONAL'),
        workshopPermission('work-orders:read', 'BOTH'),
      ],
      'en',
      '',
    );

    expect(groups.map((group) => group.key)).toEqual(['BACKOFFICE', 'OPERATIONAL']);

    const backoffice = groups.find((group) => group.key === 'BACKOFFICE')!;
    const operational = groups.find((group) => group.key === 'OPERATIONAL')!;

    const backofficeKeys = backoffice.modules.flatMap((module) =>
      module.permissions.map(({ key }) => key),
    );
    const operationalKeys = operational.modules.flatMap((module) =>
      module.permissions.map(({ key }) => key),
    );

    // Workshop BACKOFFICE permission appears under Backoffice only.
    expect(backofficeKeys).toContain('workshop-dashboard:read');
    expect(operationalKeys).not.toContain('workshop-dashboard:read');

    // Workshop OPERATIONAL permission appears under Operational only.
    expect(operationalKeys).toContain('workshop-queue:read');
    expect(backofficeKeys).not.toContain('workshop-queue:read');

    // Workshop BOTH permission appears in both experiences.
    expect(backofficeKeys).toContain('work-orders:read');
    expect(operationalKeys).toContain('work-orders:read');

    // POS grouping remains exactly as before.
    expect(backofficeKeys).toContain('sales:read');
    expect(operationalKeys).toEqual(expect.arrayContaining(['sales:create', 'sales:read']));
  });
});
