import { runtimeConfigSchema } from './runtime-config.schema';
import type { RuntimeConfig, RuntimeConfigPort } from './runtime-config.types';

export class HttpRuntimeConfigAdapter implements RuntimeConfigPort {
  public constructor(private readonly path = '/runtime-config.json') {}

  public async load(): Promise<RuntimeConfig> {
    const response = await fetch(this.path, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Runtime configuration failed with HTTP ${response.status}.`);
    }

    return runtimeConfigSchema.parse(await response.json());
  }
}
