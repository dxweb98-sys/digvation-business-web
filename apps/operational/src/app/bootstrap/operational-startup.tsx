import { ApplicationSplash, type DeploymentBootstrapConfig } from '@digvation/business-runtime';
import { Building2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react';

import {
  operationalCopy,
  resolveOperationalLocale,
} from '../localization/operational-localization';
import type { OperationalStartup as OperationalStartupPromises } from './bootstrap-operational';

/** Visual smoothing only: bootstrap and session restore are never delayed by these values. */
export const SPLASH_MINIMUM_VISIBLE_MS = 450;
const SPLASH_LEAVE_MS = 240;

type SplashPhase = 'visible' | 'leaving' | 'hidden';

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

export function OperationalStartupSplash({
  bootstrap,
}: {
  bootstrap: DeploymentBootstrapConfig | null;
}) {
  const branding = bootstrap?.branding;
  return (
    <ApplicationSplash
      // Reserve the product line until runtime branding resolves so the composition never shifts.
      productName={branding?.productName ?? ' '}
      message={operationalCopy(
        'Preparing Operational',
        resolveOperationalLocale(bootstrap?.defaults.locale),
      )}
      mark={
        branding?.logoUrl ? (
          <span className="grid size-9 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-white p-1">
            <img src={branding.logoUrl} alt="" className="size-full object-contain" />
          </span>
        ) : (
          <Building2 className="size-6" aria-hidden="true" />
        )
      }
    />
  );
}

export function OperationalStartup({
  startup,
  renderFailure,
}: {
  /** Started by the entry point before rendering so bootstrap runs exactly once. */
  startup: OperationalStartupPromises;
  renderFailure: (error: unknown) => ReactNode;
}) {
  const shownAt = useRef(0);
  const [bootstrap, setBootstrap] = useState<DeploymentBootstrapConfig | null>(null);
  const [application, setApplication] = useState<ReactNode>(null);
  const [isReady, setReady] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const [phase, setPhase] = useState<SplashPhase>('visible');

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  useEffect(() => {
    let active = true;
    startup.bootstrap.then(
      (next) => {
        if (active) setBootstrap(next);
      },
      () => undefined,
    );
    startup.application.then(
      (next) => {
        if (!active) return;
        setApplication(next);
        setReady(true);
      },
      (error: unknown) => {
        if (active) setFailure({ error });
      },
    );
    return () => {
      active = false;
    };
  }, [startup]);

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
    if (event.target === event.currentTarget && event.propertyName === 'opacity') {
      setPhase('hidden');
    }
  };

  if (failure) return <>{renderFailure(failure.error)}</>;

  return (
    <>
      {application}
      {phase === 'hidden' ? null : (
        <div
          className={`operational-startup-splash ${
            phase === 'leaving' ? 'operational-startup-splash--leaving' : ''
          }`}
          onTransitionEnd={completeLeave}
        >
          <OperationalStartupSplash bootstrap={bootstrap} />
        </div>
      )}
    </>
  );
}
