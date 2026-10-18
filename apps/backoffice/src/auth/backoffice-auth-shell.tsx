import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DCard } from '@digvation/ui';
import type { ReactNode } from 'react';

import { useBackofficeLocalization } from '../app/localization/backoffice-localization';
import { BackofficeBrandMark } from './backoffice-brand-mark';

function BrandTileMark({
  logoUrl,
  className,
}: {
  logoUrl?: string | undefined;
  className: string;
}) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] ${
        logoUrl
          ? 'border border-[var(--color-border)] bg-[var(--color-surface)]'
          : 'bg-[var(--color-brand)] text-[var(--color-brand-foreground)]'
      }`}
    >
      <BackofficeBrandMark logoUrl={logoUrl} size="sm" />
    </span>
  );
}

/**
 * Abstract composition built from the Backoffice dashboard vocabulary (surface tiles, accent
 * indicator, trend line) around the runtime brand mark. Purely presentational.
 */
function IdentityMotif({ logoUrl }: { logoUrl?: string | undefined }) {
  return (
    <div className="backoffice-auth__motif" aria-hidden="true">
      <div className="backoffice-auth__tile backoffice-auth__tile--brand">
        <BrandTileMark logoUrl={logoUrl} className="size-12" />
        <span className="backoffice-auth__bar backoffice-auth__bar--wide" />
        <span className="backoffice-auth__bar backoffice-auth__bar--short" />
      </div>
      <div className="backoffice-auth__tile backoffice-auth__tile--summary">
        <span className="backoffice-auth__indicator" />
        <span className="backoffice-auth__bar backoffice-auth__bar--wide" />
        <span className="backoffice-auth__bar backoffice-auth__bar--short" />
      </div>
      <div className="backoffice-auth__tile backoffice-auth__tile--trend">
        <svg viewBox="0 0 120 44" preserveAspectRatio="none" className="backoffice-auth__trend">
          <path
            className="backoffice-auth__trend-area"
            d="M0 36 C 16 34, 24 26, 38 28 S 62 16, 78 20 S 104 8, 120 6 L 120 44 L 0 44 Z"
          />
          <path
            className="backoffice-auth__trend-line"
            d="M0 36 C 16 34, 24 26, 38 28 S 62 16, 78 20 S 104 8, 120 6"
          />
        </svg>
      </div>
    </div>
  );
}

/** Shared split authentication card for sign-in and password recovery. */
export function BackofficeAuthShell({ children }: { children: ReactNode }) {
  const { branding } = useDeploymentBootstrap();
  const { t } = useBackofficeLocalization();

  return (
    <main className="backoffice-login h-full overflow-y-auto">
      <div className="backoffice-login__viewport grid min-h-full place-items-center">
        <DCard className="backoffice-login__card w-full max-w-[880px]">
          <aside className="backoffice-login__identity">
            <div className="backoffice-login__compact-identity flex min-w-0 items-center gap-3">
              <BrandTileMark logoUrl={branding.logoUrl} className="size-10" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
                  {branding.productName}
                </p>
                <p className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
                  {branding.companyName ?? 'Backoffice'}
                </p>
              </div>
            </div>

            <IdentityMotif logoUrl={branding.logoUrl} />

            <div className="backoffice-login__identity-caption relative">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand)]">
                Backoffice
              </p>
              <p className="mt-2 text-[1.375rem] font-semibold leading-7 tracking-[-0.02em] text-[var(--color-text)]">
                {branding.productName}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[var(--color-text-muted)]">
                {t('signInBrandCaption')}
              </p>
            </div>
          </aside>

          <section className="backoffice-login__form">
            <div className="backoffice-login__form-content mx-auto w-full max-w-[380px]">
              {children}
            </div>
          </section>
        </DCard>
      </div>
    </main>
  );
}
