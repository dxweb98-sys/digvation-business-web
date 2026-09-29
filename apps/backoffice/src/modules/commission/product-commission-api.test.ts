import { describe, expect, it, vi } from 'vitest';

import { ProductCommissionApi } from './product-commission-api';

function api() {
  const client = {
    get: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0 }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };
  return { client, subject: new ProductCommissionApi(client as never) };
}

describe('ProductCommissionApi', () => {
  it('lists rules with bounded limit/offset', async () => {
    const { client, subject } = api();
    await subject.listRules({ limit: 20, offset: 40 });
    expect(client.get).toHaveBeenCalledWith('/api/v1/commission/product-rules?limit=20&offset=40');
  });

  it('creates with expectedVersion 0 and updates with the current version', async () => {
    const { client, subject } = api();
    await subject.setRule('item-1', { expectedVersion: 0, commissionPerUnit: '5000' });
    await subject.setRule('item-1', { expectedVersion: 3, commissionPerUnit: '7500' });
    expect(client.put).toHaveBeenNthCalledWith(1, '/api/v1/commission/product-rules/item-1', {
      expectedVersion: 0,
      commissionPerUnit: '5000',
    });
    expect(client.put).toHaveBeenNthCalledWith(2, '/api/v1/commission/product-rules/item-1', {
      expectedVersion: 3,
      commissionPerUnit: '7500',
    });
  });

  it('removes a configuration under its version and sends no enabled flag', async () => {
    const { client, subject } = api();
    await subject.removeRule({ catalogItemId: 'item-1', version: 2 });
    expect(client.delete).toHaveBeenCalledWith(
      '/api/v1/commission/product-rules/item-1?expectedVersion=2',
    );
    expect(JSON.stringify(client.put.mock.calls)).not.toMatch(/enabled/i);
  });
});
