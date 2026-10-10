import { createContext, useContext, useEffect, type ReactNode } from 'react';

import type {
  AuthenticatedRuntimeProjection,
  DeploymentBootstrapConfig,
  ThemeColorConfig,
} from './runtime-config.types';
import { resolveBootstrapWorkspace } from './workspace-resolution';

const DeploymentBootstrapContext = createContext<DeploymentBootstrapConfig | null>(null);
const AuthenticatedRuntimeProjectionContext = createContext<AuthenticatedRuntimeProjection | null>(
  null,
);

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

/**
 * Transitional projection bridge for legacy `useRuntime()` consumers.
 * It stores no state and performs no request; the supplied value must come
 * directly from the canonical authenticated session context.
 */
export function AuthenticatedRuntimeProjectionProvider({
  projection,
  children,
}: {
  projection: AuthenticatedRuntimeProjection;
  children: ReactNode;
}) {
  return (
    <AuthenticatedRuntimeProjectionContext.Provider value={projection}>
      {children}
    </AuthenticatedRuntimeProjectionContext.Provider>
  );
}

/**
 * @deprecated Prefer `useDeploymentBootstrap()` for deployment data and the
 * authenticated session for business/access/preferences. This compatibility
 * view exists only while accepted screens migrate off the former aggregate.
 */
export function useRuntime() {
  const bootstrap = useDeploymentBootstrap();
  const projection = useContext(AuthenticatedRuntimeProjectionContext);

  if (!projection) {
    throw new Error(
      'AuthenticatedRuntimeProjectionProvider is missing. Use useDeploymentBootstrap() before authentication.',
    );
  }

  const permissions = projection.access.permissions;
  const capabilities = projection.access.capabilities;
  const products = projection.access.products;
  const businessName = projection.business.name;

  return {
    apiBaseUrl: bootstrap.apiBaseUrl,
    workspace: resolveBootstrapWorkspace(bootstrap) ?? '',
    locale: projection.preferences.locale,
    currency: projection.business.currency,
    defaultCountry: bootstrap.defaults.country,
    deploymentProfile: bootstrap.deploymentProfile,
    applications: {
      ...bootstrap.applications,
      cashier: bootstrap.applications.operational,
    },
    effectiveEntitlements: {
      products,
      capabilities,
    },
    effectiveFoundations: projection.access.foundations,
    effectivePermissions: permissions,
    branding: {
      ...bootstrap.branding,
      businessName,
    },
    theme: bootstrap.theme,
    capabilities: {
      notifications: permissions.some((permission) => permission.startsWith('notifications:')),
      fulfillment: permissions.some((permission) => permission.startsWith('fulfillment:')),
      customers: permissions.some((permission) => permission.startsWith('customers:')),
      loyalty: capabilities.includes('LOYALTY_POINTS'),
    },
    businessConfiguration: {
      profile: {
        name: businessName,
        configured: Boolean(businessName.trim()),
        version: 0,
        createdAt: null,
        updatedAt: null,
      },
      preferences: {
        defaultLocale: projection.preferences.locale,
        timezone: projection.preferences.timezone,
        dateFormat: projection.preferences.dateFormat,
        timeFormat: projection.preferences.timeFormat,
        version: 0,
        createdAt: null,
        updatedAt: null,
      },
    },
    contextVersion: projection.contextVersion,
  } as const;
}
