import type { DeploymentBootstrapConfig } from '@digvation/business-runtime';

/** Copy keys that name the Operational application; translated through `operationalCopy`. */
export interface OperationalApplicationCopy {
  readonly name: string;
  readonly signIn: string;
  readonly preparing: string;
  readonly notEnabled: string;
  readonly notEnabledDetail: string;
}

const LEGACY_OPERATIONAL: OperationalApplicationCopy = {
  name: 'Operational',
  signIn: 'Sign in to Operational',
  preparing: 'Preparing Operational',
  notEnabled: 'Operational is not enabled for this business',
  notEnabledDetail:
    'The modules used in Operational have not been enabled for this business. Contact your business administrator.',
};

const POS_SALON: OperationalApplicationCopy = {
  name: 'POS Salon',
  signIn: 'Sign in to POS Salon',
  preparing: 'Preparing POS Salon',
  notEnabled: 'POS Salon is not enabled for this business',
  notEnabledDetail:
    'The modules used in POS Salon have not been enabled for this business. Contact your business administrator.',
};

/**
 * Application name presented by this build. Only the deployment-declared identity selects it;
 * an absent identity (or a bootstrap that has not loaded yet) keeps the legacy Operational copy.
 */
export function operationalApplicationCopy(
  bootstrap: Pick<DeploymentBootstrapConfig, 'operationalApplication'> | null | undefined,
): OperationalApplicationCopy {
  return bootstrap?.operationalApplication === 'POS_SALON_APP' ? POS_SALON : LEGACY_OPERATIONAL;
}

/** Browser tab title: deployment product name followed by the presented application name. */
export function operationalDocumentTitle(
  bootstrap: Pick<DeploymentBootstrapConfig, 'branding' | 'operationalApplication'>,
): string {
  return `${bootstrap.branding.productName} - ${operationalApplicationCopy(bootstrap).name}`;
}
