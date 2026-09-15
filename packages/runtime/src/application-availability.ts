import type { ApplicationId, RuntimeConfig } from './runtime-config.types';

export function assertApplicationEnabled(
  config: RuntimeConfig,
  applicationId: ApplicationId,
): void {
  if (!config.applications[applicationId]) {
    throw new Error(
      `${applicationId} is not enabled for workspace ${config.workspace}. Check runtime application availability.`,
    );
  }
}
