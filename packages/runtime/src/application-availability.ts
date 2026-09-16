import type {
  ApplicationId,
  DeploymentBootstrapConfig,
} from './runtime-config.types';

export function assertApplicationEnabled(
  config: DeploymentBootstrapConfig,
  applicationId: ApplicationId,
): void {
  if (!config.applications[applicationId]) {
    throw new Error(
      `${applicationId} is not enabled for this deployment. Check deployment bootstrap application availability.`,
    );
  }
}
