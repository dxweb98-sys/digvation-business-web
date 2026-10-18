export * from '@digvation/business-runtime';

import { useAuth } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';

/**
 * Compatibility projection for accepted POS workspace code while Operational is
 * migrated to the shared Business Runtime contracts. This hook stores no state
 * and owns no authority: deployment values come from bootstrap, while business
 * identity and preferences come from the canonical authenticated session.
 */
export function useRuntime() {
  const bootstrap = useDeploymentBootstrap();
  const { session } = useAuth();

  return {
    apiBaseUrl: bootstrap.apiBaseUrl,
    locale: session.preferences.locale,
    currency: session.business.currency,
    deploymentProfile: bootstrap.deploymentProfile,
    applications: bootstrap.applications,
    branding: {
      ...bootstrap.branding,
      businessName: session.business.name,
    },
    theme: bootstrap.theme,
  } as const;
}
