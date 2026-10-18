import { HttpAuthAdapter } from '@digvation/business-auth';
import {
  assertApplicationEnabled,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
} from '@digvation/business-runtime';

import { HttpAccountActivationAdapter } from '../../auth/http-account-activation.adapter';
import { HttpPasswordRecoveryAdapter } from '../../auth/http-password-recovery.adapter';
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
  const passwordRecovery = new HttpPasswordRecoveryAdapter(
    bootstrap.apiBaseUrl,
    resolveBootstrapWorkspace(bootstrap),
  );

  const accountActivation = new HttpAccountActivationAdapter(bootstrap.apiBaseUrl);

  return {
    branding: bootstrap.branding,
    element: (
      <BackofficeProviders
        bootstrap={bootstrap}
        auth={auth}
        passwordRecovery={passwordRecovery}
        accountActivation={accountActivation}
        router={backofficeRouter}
      />
    ),
  };
}
