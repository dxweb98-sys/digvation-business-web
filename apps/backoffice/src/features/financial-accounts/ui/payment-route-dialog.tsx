import { DDialog, DInput, DSelect, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useFormState } from '../../../shared/forms/use-form-state';
import {
  RecordDialogFooter,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type {
  FinancialAccountsApi,
  PaymentMethod,
  PaymentRoute,
  RecordStatus,
} from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPES_BY_PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '../model/financial-account-model';
import {
  changePaymentMethod,
  createPaymentRouteEditorForm,
  destinationOptions,
  isPaymentRouteEditorFormValid,
  savePaymentRoute,
} from '../model/payment-route-model';
import { FinancialDialogTitle, PagedSelect, useApiErrorToast } from './financial-accounts-shared';

const OPTION_PAGE_SIZE = 20;

export const paymentRouteOptionKeys = {
  locations: ['payment-routing-locations'] as const,
  accounts: ['payment-routing-accounts'] as const,
};

export function PaymentRouteDialog({
  route,
  api,
  onClose,
  onSaved,
}: {
  /** `null` creates a route, `undefined` keeps the dialog closed. */
  route: PaymentRoute | null | undefined;
  api: Pick<
    FinancialAccountsApi,
    'listLocations' | 'listAccounts' | 'listRoutes' | 'createRoute' | 'updateRoute'
  >;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = route !== undefined;
  const fresh = route === null;
  const { copy } = useFinancialAccountsLocalization();
  const { showToast } = useToast();
  const showApiError = useApiErrorToast();
  const form = useFormState(() => createPaymentRouteEditorForm(route));
  const { sellingLocationId, paymentMethod, financialAccountId, status } = form.values;
  const [locationOffset, setLocationOffset] = useState(0);
  const [accountOffset, setAccountOffset] = useState(0);
  const [saving, setSaving] = useState(false);
  const locations = useQuery({
    queryKey: [...paymentRouteOptionKeys.locations, locationOffset],
    queryFn: () => api.listLocations(OPTION_PAGE_SIZE, locationOffset),
    enabled: open && fresh,
  });
  const accounts = useQuery({
    queryKey: [...paymentRouteOptionKeys.accounts, accountOffset],
    queryFn: () =>
      api.listAccounts({ status: 'ACTIVE', limit: OPTION_PAGE_SIZE, offset: accountOffset }),
    enabled: open,
  });
  const accountItems = accounts.data?.items ?? [];
  const valid = isPaymentRouteEditorFormValid(form.values, { fresh });
  const eligibleTypes = ACCOUNT_TYPES_BY_PAYMENT_METHOD[paymentMethod]
    .map((type) => copy(ACCOUNT_TYPE_LABELS[type]))
    .join(', ');

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await savePaymentRoute(
        api,
        form.values,
        route,
        accountItems.find((account) => account.id === financialAccountId),
      );
      onSaved();
      onClose();
      showToast({
        variant: 'success',
        title: copy(fresh ? 'Payment route added.' : 'Payment route updated.'),
      });
    } catch (error) {
      showApiError(error, copy('Could not save payment route.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <FinancialDialogTitle
          title={copy(fresh ? 'Add route' : 'Edit route')}
          {...(route ? { status: route.status } : {})}
        />
      }
      footer={
        <RecordDialogFooter
          onClose={onClose}
          onSave={() => void save()}
          disabled={!valid || saving || locations.isLoading || accounts.isLoading}
        />
      }
    >
      <div className="space-y-4">
        <RecordPanel ariaLabel={copy('Route')}>
          <RecordSectionLabel>{copy('Route')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {route ? (
              <DInput
                label={copy('Selling location')}
                value={`${route.sellingLocationName} · ${route.sellingLocationCode}`}
                disabled
                hint={copy('Locked after creation.')}
              />
            ) : (
              <PagedSelect
                label={copy('Selling location')}
                value={sellingLocationId}
                onChange={(value) => form.setField('sellingLocationId', value)}
                options={(locations.data?.items ?? []).map((location) => ({
                  value: location.id,
                  label: `${location.name} · ${location.code}`,
                  disabled: location.status !== 'ACTIVE',
                }))}
                loading={locations.isLoading}
                offset={locationOffset}
                pageSize={OPTION_PAGE_SIZE}
                count={locations.data?.items.length ?? 0}
                hasNext={Boolean(
                  locations.data && locations.data.items.length === locations.data.limit,
                )}
                onOffsetChange={setLocationOffset}
                disabled={saving}
              />
            )}
            <DSelect
              label={copy('Payment method')}
              value={paymentMethod}
              disabled={!fresh || saving}
              options={PAYMENT_METHODS.map((value) => ({
                value,
                label: copy(PAYMENT_METHOD_LABELS[value]),
              }))}
              onChange={(value) => {
                if (!value) return;
                form.patch(changePaymentMethod(value as PaymentMethod));
                setAccountOffset(0);
              }}
              hint={fresh ? undefined : copy('Locked after creation.')}
            />
          </div>
        </RecordPanel>

        <RecordPanel ariaLabel={copy('Settlement destination')}>
          <RecordSectionLabel>{copy('Settlement destination')}</RecordSectionLabel>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PagedSelect
              label={copy('Financial account')}
              value={financialAccountId}
              onChange={(value) => form.setField('financialAccountId', value)}
              options={destinationOptions(accountItems, paymentMethod, route)}
              loading={accounts.isLoading}
              offset={accountOffset}
              pageSize={OPTION_PAGE_SIZE}
              count={accountItems.length}
              hasNext={Boolean(accounts.data && accountItems.length === accounts.data.limit)}
              onOffsetChange={setAccountOffset}
              disabled={saving}
              hint={`${copy('Eligible account types')}: ${eligibleTypes}`}
            />
            {route ? (
              <DSelect
                label={copy('Status')}
                value={status}
                disabled={saving}
                options={[
                  { value: 'ACTIVE', label: copy('Active') },
                  { value: 'INACTIVE', label: copy('Inactive') },
                ]}
                onChange={(value) => value && form.setField('status', value as RecordStatus)}
              />
            ) : null}
          </div>
        </RecordPanel>
      </div>
    </DDialog>
  );
}
