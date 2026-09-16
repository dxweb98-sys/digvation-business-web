import { HttpAuthAdapter } from '@digvation/business-auth';
import {
  assertApplicationEnabled,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
} from '@digvation/business-runtime';

import { OperationalProviders } from '../providers/operational-providers';
import { operationalRouter } from '../router/operational-router';

export async function bootstrapOperational() {
  const bootstrapPort = new HttpDeploymentBootstrapAdapter();
  const bootstrap = await bootstrapPort.load();
  document.title = `${bootstrap.branding.productName} - Operational`;
  const authPort = new HttpAuthAdapter(
    bootstrap.apiBaseUrl,
    resolveBootstrapWorkspace(bootstrap),
    'operational',
  );

  assertApplicationEnabled(bootstrap, 'operational');

  const session = await authPort.me();

  return (
    <OperationalProviders
      bootstrap={bootstrap}
      session={session}
      authPort={authPort}
      router={operationalRouter}
    />
  );
}
