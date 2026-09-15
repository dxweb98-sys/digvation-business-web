import { describe, expect, it } from 'vitest';
import type { AccessPermission } from './access-control-api';
import { groupAccessPermissions } from './permission-catalog';

const permission = (
  key: string,
  label: string,
  areaKey: string,
  areaLabel: string,
  order: number,
): AccessPermission => ({
  key,
  label: { id: label, en: label },
  product: 'POS',
  capability: null,
  section: { key: 'POS', label: { id: 'POS', en: 'POS' }, order: 10 },
  businessArea: {
    key: areaKey,
    label: { id: areaLabel, en: areaLabel },
    order: 20,
  },
  surface: 'OPERATIONAL',
  configurable: true,
  order,
});

const permissions = [
  permission('sales:finalize', 'Selesaikan transaksi', 'SALES', 'Penjualan', 40),
  permission('sales:void', 'Batalkan transaksi', 'SALES', 'Penjualan', 50),
  permission('sales:discount', 'Berikan diskon', 'SALES', 'Penjualan', 70),
  permission(
    'fulfillment:update',
    'Atur pengerjaan layanan',
    'FULFILLMENT',
    'Pengerjaan',
    20,
  ),
];

describe('groupAccessPermissions', () => {
  it('uses Runtime section and business-area metadata without parsing permission keys', () => {
    expect(groupAccessPermissions(permissions, 'id', '')).toMatchObject([
      {
        key: 'POS',
        label: 'POS',
        areas: [
          {
            key: 'FULFILLMENT',
            label: 'Pengerjaan',
            permissions: [{ key: 'fulfillment:update' }],
          },
          {
            key: 'SALES',
            label: 'Penjualan',
            permissions: [
              { key: 'sales:finalize' },
              { key: 'sales:void' },
              { key: 'sales:discount' },
            ],
          },
        ],
      },
    ]);
  });

  it('searches permission, area, section, and internal key while returning human metadata', () => {
    expect(groupAccessPermissions(permissions, 'id', 'diskon')[0]?.areas[0]?.permissions).toEqual([
      expect.objectContaining({ key: 'sales:discount' }),
    ]);
    expect(groupAccessPermissions(permissions, 'id', 'Penjualan')[0]?.areas[0]?.permissions).toHaveLength(
      3,
    );
    expect(groupAccessPermissions(permissions, 'id', 'sales:void')[0]?.areas[0]?.permissions).toEqual([
      expect.objectContaining({ key: 'sales:void' }),
    ]);
  });
});
