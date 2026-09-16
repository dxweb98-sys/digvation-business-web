import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type {
  DeploymentBootstrapConfig,
  ThemeColorConfig,
} from './runtime-config.types';

const DeploymentBootstrapContext = createContext<DeploymentBootstrapConfig | null>(null);

const THEME_COLOR_PROPERTIES: Record<keyof ThemeColorConfig, string> = {
  background: '--color-background',
  surface: '--color-surface',
  surfaceMuted: '--color-surface-muted',
  text: '--color-text',
  textMuted: '--color-text-muted',
  border: '--color-border',
  brand: '--color-brand',
  focus: '--color-focus',
  accentYellow: '--color-accent-yellow',
  accentMint: '--color-accent-mint',
  accentSky: '--color-accent-sky',
  accentLavender: '--color-accent-lavender',
  accentCoral: '--color-accent-coral',
};

interface DeploymentBootstrapProviderProps {
  config: DeploymentBootstrapConfig;
  children: ReactNode;
}

export function DeploymentBootstrapProvider({
  config,
  children,
}: DeploymentBootstrapProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const previousPreset = root.dataset.themePreset;
    const previousRadius = root.dataset.themeRadius;
    const previousProperties = new Map<string, string>();
    const themeEntries = Object.entries(THEME_COLOR_PROPERTIES) as Array<
      [keyof ThemeColorConfig, string]
    >;

    root.dataset.themePreset = config.theme.preset;
    root.dataset.themeRadius = config.theme.radius;

    for (const [key, property] of themeEntries) {
      previousProperties.set(property, root.style.getPropertyValue(property));
      const value = config.theme.colors?.[key];

      if (value) {
        root.style.setProperty(property, value);
      }
    }

    return () => {
      if (previousPreset) {
        root.dataset.themePreset = previousPreset;
      } else {
        delete root.dataset.themePreset;
      }

      if (previousRadius) {
        root.dataset.themeRadius = previousRadius;
      } else {
        delete root.dataset.themeRadius;
      }

      for (const [property, value] of previousProperties) {
        if (value) {
          root.style.setProperty(property, value);
        } else {
          root.style.removeProperty(property);
        }
      }
    };
  }, [config.theme]);

  return (
    <DeploymentBootstrapContext.Provider value={config}>
      {children}
    </DeploymentBootstrapContext.Provider>
  );
}

export function useDeploymentBootstrap(): DeploymentBootstrapConfig {
  const bootstrap = useContext(DeploymentBootstrapContext);

  if (!bootstrap) {
    throw new Error('DeploymentBootstrapProvider is missing.');
  }

  return bootstrap;
}
