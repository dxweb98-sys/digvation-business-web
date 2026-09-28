import type { ReactNode } from 'react';

import type { SplashPreset } from './presentation';

interface ApplicationSplashProps {
  productName?: string;
  message?: string;
  mark?: ReactNode;
  /**
   * Resolved from the effective PresentationProvider bundle by the caller
   * (splash renders before the provider mounts, so callers resolve the
   * bundle directly from bootstrap). DEFAULT reproduces today's exact
   * composition. IMMERSIVE differs only through scale, brand emphasis and
   * background hierarchy — never product-specific content.
   */
  variant?: SplashPreset;
}

export function ApplicationSplash({
  productName = 'Digvation Business',
  message = 'Menyiapkan aplikasi',
  mark = <span className="text-lg font-bold">D</span>,
  variant = 'DEFAULT',
}: ApplicationSplashProps) {
  const immersive = variant === 'IMMERSIVE';

  if (immersive) {
    return (
      <main
        aria-busy="true"
        aria-live="polite"
        data-splash-variant={variant}
        className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-6 text-center"
      >
        {/* One deliberate geometric accent — a flat top rule, not a soft decorative glow. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--color-brand)]" />
        <section className="relative w-full max-w-sm">
          <div className="relative mx-auto grid size-20 place-items-center rounded-[var(--radius-card)] border-2 border-[var(--color-brand)] bg-[var(--color-brand)] text-white">
            <span className="relative grid place-items-center" aria-hidden="true">
              {mark}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-[var(--presentation-heading-tracking,-0.04em)]">
            {productName}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</p>
          {/* A single deliberate loading rule — firm and determinate, not a playful bounce. */}
          <div
            className="mx-auto mt-7 h-[3px] w-24 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
            aria-hidden="true"
          >
            <span className="splash-sweep-bar block h-full w-1/3 bg-[var(--color-brand)]" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      data-splash-variant={variant}
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-6 text-center"
    >
      <div className="pointer-events-none absolute left-[12%] top-[18%] size-64 rounded-full bg-[var(--color-brand)] opacity-[0.035] blur-3xl transition-[opacity] duration-[var(--motion-duration-entrance)]" />
      <div className="pointer-events-none absolute bottom-[12%] right-[14%] size-56 rounded-full bg-[var(--color-accent-lavender)] opacity-25 blur-3xl" />
      <section className="relative w-full max-w-sm">
        <div className="relative mx-auto grid size-14 place-items-center rounded-[var(--radius-card)] bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20">
          <span className="absolute inset-0 animate-ping rounded-[var(--radius-card)] bg-[var(--color-brand)]/20 [animation-duration:2s]" />
          <span className="relative grid place-items-center" aria-hidden="true">
            {mark}
          </span>
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-[-0.04em]">{productName}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</p>
        <div className="mt-7 flex justify-center gap-1.5" aria-hidden="true">
          <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand)]" />
          <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand)] [animation-delay:150ms]" />
          <span className="size-2 animate-pulse rounded-full bg-[var(--color-brand)] [animation-delay:300ms]" />
        </div>
      </section>
    </main>
  );
}
