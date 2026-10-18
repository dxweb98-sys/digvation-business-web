import { describe, expect, it, vi } from 'vitest';

import type {
  FinancialAccount,
  FinancialAccountType,
  PaymentMethod,
  PaymentRoute,
} from '../api/financial-accounts-api';
import { isAccountCompatible } from './financial-account-model';
import {
  changePaymentMethod,
  createPaymentRouteEditorForm,
  destinationOptions,
  isPaymentRouteEditorFormValid,
  provisionDefaultCheckoutRoute,
  savePaymentRoute,
} from './payment-route-model';

const account = (type: FinancialAccountType, change: Partial<FinancialAccount> = {}) =>
  ({
    id: `${type.toLowerCase()}-account`,
    code: `${type}_MAIN`,
    name: `${type} account`,
    type,
    currency: 'IDR',
    institutionName: type === 'CASH' ? null : 'BCA',
    accountReference: type === 'CASH' ? null : '123',
    accountHolderName: null,
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...change,
  }) satisfies FinancialAccount;

const route = (change: Partial<PaymentRoute> = {}): PaymentRoute => ({
  id: 'route-1',
  sellingLocationId: 'location-1',
  sellingLocationCode: 'MAIN',
  sellingLocationName: 'Main',
  paymentMethod: 'QRIS',
  currency: 'IDR',
  financialAccountId: 'bank-account',
  financialAccountCode: 'BANK_MAIN',
  financialAccountName: 'Bank account',
  financialAccountType: 'BANK',
  status: 'ACTIVE',
  version: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...change,
});

describe('payment route compatibility', () => {
  it.each<[PaymentMethod, FinancialAccountType[], FinancialAccountType[]]>([
    ['QRIS', ['QRIS', 'BANK', 'E_WALLET'], ['CASH']],
    ['BANK_TRANSFER', ['BANK'], ['QRIS', 'E_WALLET', 'CASH']],
    ['WALLET', ['E_WALLET'], ['QRIS', 'BANK', 'CASH']],
    ['CASH', ['CASH'], ['QRIS', 'BANK', 'E_WALLET']],
  ])('%s accepts %j and rejects %j', (method, accepted, rejected) => {
    for (const type of accepted) expect(isAccountCompatible(method, type)).toBe(true);
    for (const type of rejected) expect(isAccountCompatible(method, type)).toBe(false);
  });

  it('disables incompatible destinations in the selection list', () => {
    const accounts = (['CASH', 'BANK', 'E_WALLET', 'QRIS'] as const).map((type) => account(type));
    const enabled = (method: PaymentMethod) =>
      destinationOptions(accounts, method, null)
        .filter((option) => !option.disabled)
        .map((option) => option.value);
    expect(enabled('QRIS')).toEqual(['bank-account', 'e_wallet-account', 'qris-account']);
    expect(enabled('BANK_TRANSFER')).toEqual(['bank-account']);
    expect(enabled('WALLET')).toEqual(['e_wallet-account']);
    expect(enabled('CASH')).toEqual(['cash-account']);
  });

  it('keeps the current destination of an existing route selectable and shows legacy codes quietly', () => {
    const options = destinationOptions(
      [],
      'QRIS',
      route({ financialAccountCode: null, financialAccountName: 'Legacy bank' }),
    );
    expect(options).toEqual([
      { value: 'bank-account', label: 'Legacy bank · — · IDR', disabled: false },
    ]);
  });
});

describe('payment route editor form', () => {
  it('requires a location only when creating', () => {
    const fresh = createPaymentRouteEditorForm(null);
    expect(isPaymentRouteEditorFormValid(fresh, { fresh: true })).toBe(false);
    expect(
      isPaymentRouteEditorFormValid(
        { ...fresh, sellingLocationId: 'location-1', financialAccountId: 'qris-account' },
        { fresh: true },
      ),
    ).toBe(true);
    expect(
      isPaymentRouteEditorFormValid(createPaymentRouteEditorForm(route()), { fresh: false }),
    ).toBe(true);
  });

  it('clears the destination when the payment method changes', () => {
    expect(changePaymentMethod('WALLET')).toEqual({
      paymentMethod: 'WALLET',
      financialAccountId: '',
    });
  });
});

function routeApi(
  existing: PaymentRoute[] = [],
  locations = [{ id: 'location-1', status: 'ACTIVE' }],
) {
  return {
    listLocations: vi.fn(async () => ({ items: locations, limit: 100, offset: 0 })),
    listRoutes: vi.fn(async () => ({
      items: existing,
      limit: 100,
      offset: 0,
      total: existing.length,
    })),
    createRoute: vi.fn(async () => route()),
    updateRoute: vi.fn(async () => route()),
  };
}

describe('saving a payment route', () => {
  it('updates destination and status of an existing route', async () => {
    const api = routeApi();
    const existing = route();
    await savePaymentRoute(
      api as never,
      {
        ...createPaymentRouteEditorForm(existing),
        financialAccountId: 'qris-account',
        status: 'INACTIVE',
      },
      existing,
      undefined,
    );
    expect(api.updateRoute).toHaveBeenCalledWith(existing, {
      financialAccountId: 'qris-account',
      status: 'INACTIVE',
    });
  });

  it('reactivates the matching inactive route instead of creating a duplicate', async () => {
    const inactive = route({ financialAccountId: 'qris-account', status: 'INACTIVE' });
    const api = routeApi([inactive]);
    await savePaymentRoute(
      api as never,
      {
        sellingLocationId: 'location-1',
        paymentMethod: 'QRIS',
        financialAccountId: 'qris-account',
        status: 'ACTIVE',
      },
      null,
      account('QRIS'),
    );
    expect(api.updateRoute).toHaveBeenCalledWith(inactive, { status: 'ACTIVE' });
    expect(api.createRoute).not.toHaveBeenCalled();
  });
});

describe('default checkout route provisioning', () => {
  it.each<[FinancialAccountType, PaymentMethod]>([
    ['CASH', 'CASH'],
    ['BANK', 'BANK_TRANSFER'],
    ['E_WALLET', 'WALLET'],
    ['QRIS', 'QRIS'],
  ])('routes a new %s account for %s at the only active location', async (type, method) => {
    const api = routeApi();
    await expect(provisionDefaultCheckoutRoute(api as never, account(type))).resolves.toBe(true);
    expect(api.createRoute).toHaveBeenCalledWith({
      sellingLocationId: 'location-1',
      paymentMethod: method,
      financialAccountId: account(type).id,
    });
  });

  it('leaves routing to the user when there is not exactly one active location', async () => {
    const api = routeApi(
      [],
      [
        { id: 'location-1', status: 'ACTIVE' },
        { id: 'location-2', status: 'ACTIVE' },
      ],
    );
    await expect(provisionDefaultCheckoutRoute(api as never, account('QRIS'))).resolves.toBe(false);
    expect(api.createRoute).not.toHaveBeenCalled();
  });

  it('does not route an inactive account', async () => {
    const api = routeApi();
    await expect(
      provisionDefaultCheckoutRoute(api as never, account('BANK', { status: 'INACTIVE' })),
    ).resolves.toBe(false);
    expect(api.listLocations).not.toHaveBeenCalled();
  });
});
