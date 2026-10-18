import { HttpAuthAdapter } from '@digvation/business-auth';
import {
  assertApplicationEnabled,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import type { ReactNode } from 'react';

import { OperationalProviders } from '../providers/operational-providers';
import { operationalRouter } from '../router/operational-router';

export interface OperationalStartup {
  /** Resolves as soon as the deployment bootstrap is loaded, before session restore finishes. */
  bootstrap: Promise<DeploymentBootstrapConfig>;
  /** Resolves once the session has been restored and the application tree is ready to mount. */
  application: Promise<ReactNode>;
}

export function bootstrapOperational(): OperationalStartup {
  const bootstrap = new HttpDeploymentBootstrapAdapter().load();

  const application = bootstrap.then(async (config) => {
    document.title = `${config.branding.productName} - Operational`;
    const authPort = new HttpAuthAdapter(
      config.apiBaseUrl,
      resolveBootstrapWorkspace(config),
      'operational',
    );

    assertApplicationEnabled(config, 'operational');

    const session = await authPort.me();

    return (
      <OperationalProviders
        bootstrap={config}
        session={session}
        authPort={authPort}
        router={operationalRouter}
      />
    );
  });

  return { bootstrap, application };
}
