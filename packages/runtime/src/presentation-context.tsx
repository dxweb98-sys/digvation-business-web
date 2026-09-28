import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { resolvePresentationBundle, type PresentationBundle } from './presentation';
import { useDeploymentBootstrap } from './runtime-context';

interface PresentationContextValue {
  bundle: PresentationBundle;
}

const PresentationContext = createContext<PresentationContextValue | null>(null);

/**
 * Resolves the effective PresentationPreset from the deployment bootstrap
 * config only — presentation is deployment-controlled end-to-end, identically
 * pre- and post-auth. There is no tenant-editable override: the same
 * `presentationPreset` from `runtime-config.json` applies everywhere. Absent
 * falls back to DEFAULT. Resolves into the finite dimension bundle and
 * applies it as `data-*` attributes on `documentElement` so CSS can key off
 * it (mirroring the existing `data-theme-preset`/`data-theme-radius`
 * mechanism). Mount this once, inside `DeploymentBootstrapProvider`, wrapping
 * both pre- and post-auth views, so pre-auth surfaces (splash/login) already
 * resolve correctly and there is never a visible jump at authentication.
 */
export function PresentationProvider({ children }: { children: ReactNode }) {
  const bootstrap = useDeploymentBootstrap();

  const effectivePreset = bootstrap.presentationPreset;
  const bundle = useMemo(() => resolvePresentationBundle(effectivePreset), [effectivePreset]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      preset: root.dataset.presentationPreset,
      appearance: root.dataset.appearance,
      motion: root.dataset.motion,
      loginLayout: root.dataset.loginLayout,
      shellLayout: root.dataset.shellLayout,
      splash: root.dataset.splash,
    };

    root.dataset.presentationPreset = effectivePreset ?? 'DEFAULT';
    root.dataset.appearance = bundle.appearance;
    root.dataset.motion = bundle.motion;
    root.dataset.loginLayout = bundle.loginLayout;
    root.dataset.shellLayout = bundle.shellLayout;
    root.dataset.splash = bundle.splash;

    return () => {
      if (previous.preset) root.dataset.presentationPreset = previous.preset;
      else delete root.dataset.presentationPreset;
      if (previous.appearance) root.dataset.appearance = previous.appearance;
      else delete root.dataset.appearance;
      if (previous.motion) root.dataset.motion = previous.motion;
      else delete root.dataset.motion;
      if (previous.loginLayout) root.dataset.loginLayout = previous.loginLayout;
      else delete root.dataset.loginLayout;
      if (previous.shellLayout) root.dataset.shellLayout = previous.shellLayout;
      else delete root.dataset.shellLayout;
      if (previous.splash) root.dataset.splash = previous.splash;
      else delete root.dataset.splash;
    };
  }, [bundle, effectivePreset]);

  const value = useMemo(() => ({ bundle }), [bundle]);

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

/** The resolved, finite presentation bundle. Components consume this — they must never branch on preset name directly. */
export function usePresentationBundle(): PresentationBundle {
  const context = useContext(PresentationContext);

  if (!context) {
    throw new Error('PresentationProvider is missing.');
  }

  return context.bundle;
}
