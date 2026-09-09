import { assertApplicationEnabled, HttpRuntimeConfigAdapter } from '@digvation/business-runtime';

import { HttpAuthAdapter } from '../../auth/http-auth-adapter';
import { BackofficeProviders } from '../providers/backoffice-providers';
import { backofficeRouter } from '../router/backoffice-router';

export async function bootstrapBackoffice() {
  const runtimePort = new HttpRuntimeConfigAdapter();
  const runtime = await runtimePort.load();
  document.title = `${runtime.branding.productName} â€” Backoffice`;

  assertApplicationEnabled(runtime, 'backoffice');
  const auth = new HttpAuthAdapter(runtime.apiBaseUrl, runtime.workspace);

  return <BackofficeProviders runtime={runtime} auth={auth} router={backofficeRouter} />;
}
