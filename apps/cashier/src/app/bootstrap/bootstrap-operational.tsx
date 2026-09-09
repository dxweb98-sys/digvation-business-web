import { HttpAuthAdapter } from '@digvation/business-auth';
import { assertApplicationEnabled, HttpRuntimeConfigAdapter } from '@digvation/business-runtime';

import { OperationalProviders } from '../providers/operational-providers';
import { operationalRouter } from '../router/operational-router';

export async function bootstrapOperational() {
  const runtimePort = new HttpRuntimeConfigAdapter();
  const runtime = await runtimePort.load();
  document.title = `${runtime.branding.productName} â€” Operational`;
  const authPort = new HttpAuthAdapter(runtime.apiBaseUrl, runtime.workspace, 'operational');

  assertApplicationEnabled(runtime, 'cashier');

  const session = await authPort.me();

  return (
    <OperationalProviders
      runtime={runtime}
      session={session}
      authPort={authPort}
      router={operationalRouter}
    />
  );
}
