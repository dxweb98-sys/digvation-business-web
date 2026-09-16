import { runtimeConfigSchema } from './runtime-config.schema';
import type {
  DeploymentBootstrapConfig,
  DeploymentBootstrapConfigPort,
} from './runtime-config.types';

export class HttpDeploymentBootstrapAdapter implements DeploymentBootstrapConfigPort {
  public constructor(private readonly path = '/runtime-config.json') {}

  public async load(): Promise<DeploymentBootstrapConfig> {
    const response = await fetch(this.path, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Deployment bootstrap failed with HTTP ${response.status}.`);
    }

    return runtimeConfigSchema.parse(await response.json());
  }
}
