import type {
  FinancialAccount,
  FinancialAccountsApi,
  PaymentMethod,
  PaymentRoute,
  RecordStatus,
} from '../api/financial-accounts-api';
import {
  DEFAULT_PAYMENT_METHOD_BY_ACCOUNT_TYPE,
  displayCode,
  isAccountCompatible,
} from './financial-account-model';

export interface PaymentRouteEditorForm {
  sellingLocationId: string;
  paymentMethod: PaymentMethod;
  financialAccountId: string;
  status: RecordStatus;
}

export function createPaymentRouteEditorForm(
  route: PaymentRoute | null | undefined,
): PaymentRouteEditorForm {
  return {
    sellingLocationId: route?.sellingLocationId ?? '',
    paymentMethod: route?.paymentMethod ?? 'CASH',
    financialAccountId: route?.financialAccountId ?? '',
    status: route?.status ?? 'ACTIVE',
  };
}

/** A different payment method can need a different destination type, so the choice is cleared. */
export function changePaymentMethod(paymentMethod: PaymentMethod): Partial<PaymentRouteEditorForm> {
  return { paymentMethod, financialAccountId: '' };
}

export function isPaymentRouteEditorFormValid(
  form: PaymentRouteEditorForm,
  { fresh }: { fresh: boolean },
) {
  return Boolean((!fresh || form.sellingLocationId) && form.financialAccountId);
}

export interface DestinationOption {
  value: string;
  label: string;
  disabled: boolean;
}

export function destinationLabel(name: string, code: string | null, currency: string) {
  return `${name} · ${displayCode(code)} · ${currency}`;
}

/**
 * Active accounts are listed with incompatible types disabled. The current destination of an
 * existing route stays selectable even when it is not on the loaded page.
 */
export function destinationOptions(
  accounts: readonly FinancialAccount[],
  paymentMethod: PaymentMethod,
  route: PaymentRoute | null | undefined,
): DestinationOption[] {
  const options = accounts.map((account) => ({
    value: account.id,
    label: destinationLabel(account.name, account.code, account.currency),
    disabled: !isAccountCompatible(paymentMethod, account.type),
  }));
  if (route && !options.some((option) => option.value === route.financialAccountId))
    options.unshift({
      value: route.financialAccountId,
      label: destinationLabel(
        route.financialAccountName,
        route.financialAccountCode,
        route.currency,
      ),
      disabled: false,
    });
  return options;
}

type RouteApi = Pick<FinancialAccountsApi, 'listRoutes' | 'createRoute' | 'updateRoute'>;

async function findSameAccountRoute(
  api: RouteApi,
  input: { sellingLocationId: string; paymentMethod: PaymentMethod },
  account: Pick<FinancialAccount, 'id' | 'currency'> | undefined,
  accountId: string,
) {
  const existing = await api.listRoutes({ ...input, limit: 100, offset: 0 });
  return existing.items.find(
    (route) => route.financialAccountId === accountId && route.currency === account?.currency,
  );
}

/**
 * Creates a route, or reactivates the existing route for the same location, method, and
 * destination so a previously deactivated route is reused instead of duplicated.
 */
export async function savePaymentRoute(
  api: RouteApi,
  form: PaymentRouteEditorForm,
  route: PaymentRoute | null | undefined,
  account: FinancialAccount | undefined,
) {
  if (route)
    return api.updateRoute(route, {
      financialAccountId: form.financialAccountId,
      status: form.status,
    });
  const input = {
    sellingLocationId: form.sellingLocationId,
    paymentMethod: form.paymentMethod,
  };
  const sameAccountRoute = await findSameAccountRoute(api, input, account, form.financialAccountId);
  if (sameAccountRoute) return api.updateRoute(sameAccountRoute, { status: 'ACTIVE' });
  return api.createRoute({ ...input, financialAccountId: form.financialAccountId });
}

/**
 * When the business has exactly one active location, a saved active account is routed for its
 * default checkout method so it is usable in Operational checkout immediately. Returns whether
 * a route is in place; any other situation is left to Payment Routing.
 */
export async function provisionDefaultCheckoutRoute(
  api: RouteApi & Pick<FinancialAccountsApi, 'listLocations'>,
  account: FinancialAccount,
): Promise<boolean> {
  if (account.status !== 'ACTIVE') return false;
  const paymentMethod = DEFAULT_PAYMENT_METHOD_BY_ACCOUNT_TYPE[account.type];
  const locations = await api.listLocations(100, 0);
  const activeLocations = locations.items.filter((location) => location.status === 'ACTIVE');
  if (activeLocations.length !== 1) return false;

  const input = { sellingLocationId: activeLocations[0]!.id, paymentMethod };
  const sameAccountRoute = await findSameAccountRoute(api, input, account, account.id);
  if (sameAccountRoute) {
    if (sameAccountRoute.status !== 'ACTIVE')
      await api.updateRoute(sameAccountRoute, { status: 'ACTIVE' });
    return true;
  }
  await api.createRoute({ ...input, financialAccountId: account.id });
  return true;
}
