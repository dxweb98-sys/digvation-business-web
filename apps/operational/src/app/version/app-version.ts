import packageJson from '../../../package.json';

export interface AppVersion {
  version: string;
  revision: string;
}

export function getAppVersion(): AppVersion {
  return {
    version: packageJson.version,
    revision: import.meta.env.VITE_BUILD_REVISION || 'local',
  };
}
