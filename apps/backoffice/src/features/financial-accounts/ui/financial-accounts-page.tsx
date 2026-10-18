import { useRuntime } from '@digvation/business-runtime';
import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BackofficePage, BackofficePageHeader } from '../../../app/layout/backoffice-page';
import { canPerformBackofficeAction, type BackofficeAction } from '../../../auth/backoffice-access';
import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import { FinancialAccountsApi } from '../api/financial-accounts-api';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';
import { financialAccountKeys, FinancialAccountsTab } from './financial-accounts-tab';
import { paymentRouteOptionKeys } from './payment-route-dialog';
import { paymentRouteKeys, PaymentRoutingTab } from './payment-routing-tab';

export function FinancialAccountsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy } = useFinancialAccountsLocalization();
  const client = useQueryClient();
  const api = useMemo(
    () => new FinancialAccountsApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  if (!session) return null;

  const can = (action: BackofficeAction) => canPerformBackofficeAction(session, action);
  const refreshRoutes = () => {
    void client.invalidateQueries({ queryKey: paymentRouteKeys.list });
  };
  // Account saves can provision a default route and rename route destinations.
  const refreshAccounts = () => {
    void client.invalidateQueries({ queryKey: financialAccountKeys.list });
    void client.invalidateQueries({ queryKey: paymentRouteOptionKeys.accounts });
    refreshRoutes();
  };

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Finance')}
        title={copy('Financial Accounts')}
        description={copy(
          'Configure settlement destinations and location-specific payment routing.',
        )}
      />

      <DTabs defaultValue="accounts" className="mt-6">
        <DTabsList className="max-w-full overflow-x-auto">
          <DTabsTrigger value="accounts">{copy('Accounts')}</DTabsTrigger>
          <DTabsTrigger value="routing">{copy('Payment routing')}</DTabsTrigger>
        </DTabsList>

        <DTabsContent value="accounts" className="mt-4">
          <FinancialAccountsTab
            api={api}
            canCreate={can('createFinancialAccount')}
            canUpdate={can('updateFinancialAccount')}
            onAccountsChanged={refreshAccounts}
          />
        </DTabsContent>

        <DTabsContent value="routing" className="mt-4">
          <PaymentRoutingTab
            api={api}
            canUpdate={can('updatePaymentRouting')}
            onRoutesChanged={refreshRoutes}
          />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}
