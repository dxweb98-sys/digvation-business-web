import { HttpAuthAdapter } from '@digvation/pos-auth';
import { assertApplicationEnabled, HttpRuntimeConfigAdapter } from '@digvation/pos-runtime';

import { CashierProviders } from '../providers/cashier-providers';
import { posOperationalRouter } from '../../modules/pos/pos-operational-router';

export async function bootstrapCashier() {
  const runtimePort = new HttpRuntimeConfigAdapter();
  const runtime = await runtimePort.load();
  const authPort = new HttpAuthAdapter(runtime.apiBaseUrl, runtime.workspace, 'operational');

  assertApplicationEnabled(runtime, 'cashier');

  const session = await authPort.me();

  return (
    <CashierProviders
      runtime={runtime}
      session={session}
      authPort={authPort}
      router={posOperationalRouter}
    />
  );
}
