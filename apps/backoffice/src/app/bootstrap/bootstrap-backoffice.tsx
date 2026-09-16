import { HttpAuthAdapter } from '@digvation/business-auth';
import {
  assertApplicationEnabled,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
} from '@digvation/business-runtime';

import { BackofficeProviders } from '../providers/backoffice-providers';
import { backofficeRouter } from '../router/backoffice-router';

export async function bootstrapBackoffice() {
  const bootstrapPort = new HttpDeploymentBootstrapAdapter();
  const bootstrap = await bootstrapPort.load();
  document.title = `${bootstrap.branding.productName} Backoffice`;

  assertApplicationEnabled(bootstrap, 'backoffice');
  const auth = new HttpAuthAdapter(
    bootstrap.apiBaseUrl,
    resolveBootstrapWorkspace(bootstrap),
    'backoffice',
  );

  return (
    <BackofficeProviders
      bootstrap={bootstrap}
      auth={auth}
      router={backofficeRouter}
    />
  );
}
