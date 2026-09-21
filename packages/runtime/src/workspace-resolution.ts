import type { DeploymentBootstrapConfig } from './runtime-config.types';

export function resolveBootstrapWorkspace(config: DeploymentBootstrapConfig): string | undefined {
  const resolution = config.workspaceResolution;
  return resolution.mode === 'FIXED' ? resolution.workspace : resolution.defaultWorkspace;
}
