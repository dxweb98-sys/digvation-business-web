import { HttpAuthAdapter } from '@digvation/business-auth';
import {
  assertApplicationEnabled,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
} from '@digvation/business-runtime';

import { unavailablePasswordRecovery } from '../../auth/password-recovery';
import { BackofficeProviders } from '../providers/backoffice-providers';
import { backofficeRouter } from '../router/backoffice-router';
import type { BackofficeStartupResult } from './backoffice-startup';

export async function bootstrapBackoffice(): Promise<BackofficeStartupResult> {
  const bootstrapPort = new HttpDeploymentBootstrapAdapter();
  const bootstrap = await bootstrapPort.load();
  document.title = `${bootstrap.branding.productName} Backoffice`;

  assertApplicationEnabled(bootstrap, 'backoffice');
  const auth = new HttpAuthAdapter(
    bootstrap.apiBaseUrl,
    resolveBootstrapWorkspace(bootstrap),
    'backoffice',
  );
  // Integration point: replace with the Runtime WhatsApp recovery adapter (constructed like the auth
  // adapter from apiBaseUrl + trusted bootstrap workspace) once that engine is available.
  const passwordRecovery = unavailablePasswordRecovery;

  return {
    branding: bootstrap.branding,
    element: (
      <BackofficeProviders
        bootstrap={bootstrap}
        auth={auth}
        passwordRecovery={passwordRecovery}
        router={backofficeRouter}
      />
    ),
  };
}
