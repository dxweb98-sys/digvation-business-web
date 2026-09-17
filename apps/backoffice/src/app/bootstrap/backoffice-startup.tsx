import { ApplicationSplash, type DeploymentBootstrapConfig } from '@digvation/business-runtime';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from 'react';

import { BackofficeBrandMark } from '../../auth/backoffice-brand-mark';
import { readStoredBackofficeLocale } from '../localization/backoffice-localization-base';

/** Visual smoothing only: bootstrap and session restore are never delayed by these values. */
export const SPLASH_MINIMUM_VISIBLE_MS = 450;
const SPLASH_LEAVE_MS = 240;

export interface BackofficeStartupResult {
  branding: DeploymentBootstrapConfig['branding'];
  element: ReactNode;
}

type SplashPhase = 'visible' | 'leaving' | 'hidden';

const BackofficeStartupReadyContext = createContext<() => void>(() => undefined);

/** Signals that the first meaningful Backoffice screen (sign-in or application) is mounted. */
export function useBackofficeStartupReady(): () => void {
  return useContext(BackofficeStartupReadyContext);
}

export function remainingSplashTime(
  shownAt: number,
  now: number,
  minimum = SPLASH_MINIMUM_VISIBLE_MS,
): number {
  return Math.max(0, minimum - (now - shownAt));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function BackofficeStartupSplash({
  branding,
}: {
  branding?: DeploymentBootstrapConfig['branding'] | undefined;
}) {
  return (
    <ApplicationSplash
      // Reserve the product line until runtime branding resolves so the composition never shifts.
      productName={branding?.productName ?? ' '}
      message={
        readStoredBackofficeLocale() === 'en' ? 'Preparing Backoffice' : 'Menyiapkan Backoffice'
      }
      mark={<BackofficeBrandMark logoUrl={branding?.logoUrl} />}
    />
  );
}

export function BackofficeStartup({
  startup,
  renderFailure,
}: {
  /** Started by the entry point before rendering so bootstrap runs exactly once. */
  startup: Promise<BackofficeStartupResult>;
  renderFailure: (error: unknown) => ReactNode;
}) {
  const shownAt = useRef(0);
  const [result, setResult] = useState<BackofficeStartupResult | null>(null);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const [isReady, setReady] = useState(false);
  const [phase, setPhase] = useState<SplashPhase>('visible');

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  useEffect(() => {
    let active = true;
    startup.then(
      (started) => {
        if (active) setResult(started);
      },
      (error: unknown) => {
        if (active) setFailure({ error });
      },
    );
    return () => {
      active = false;
    };
  }, [startup]);

  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!isReady || phase !== 'visible') return undefined;
    const timer = window.setTimeout(
      () => setPhase(prefersReducedMotion() ? 'hidden' : 'leaving'),
      remainingSplashTime(shownAt.current, performance.now()),
    );
    return () => window.clearTimeout(timer);
  }, [isReady, phase]);

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    // Fallback in case the opacity transition end is never delivered.
    const timer = window.setTimeout(() => setPhase('hidden'), SPLASH_LEAVE_MS + 120);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const completeLeave = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.propertyName === 'opacity')
      setPhase('hidden');
  };

  if (failure) return <>{renderFailure(failure.error)}</>;

  return (
    <BackofficeStartupReadyContext.Provider value={markReady}>
      {result?.element}
      {phase === 'hidden' ? null : (
        <div
          className={`backoffice-startup-splash ${
            phase === 'leaving' ? 'backoffice-startup-splash--leaving' : ''
          }`}
          onTransitionEnd={completeLeave}
        >
          <BackofficeStartupSplash branding={result?.branding} />
        </div>
      )}
    </BackofficeStartupReadyContext.Provider>
  );
}
