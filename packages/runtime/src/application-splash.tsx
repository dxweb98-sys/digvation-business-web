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
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      data-splash-variant={variant}
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-6 text-center"
    >
      <div
        className={`pointer-events-none absolute left-[12%] top-[18%] rounded-full bg-[var(--color-brand)] blur-3xl transition-[opacity] duration-[var(--motion-duration-entrance)] ${
          immersive ? 'size-96 opacity-[0.09]' : 'size-64 opacity-[0.035]'
        }`}
      />
      <div
        className={`pointer-events-none absolute bottom-[12%] right-[14%] rounded-full bg-[var(--color-accent-lavender)] blur-3xl ${
          immersive ? 'size-80 opacity-30' : 'size-56 opacity-25'
        }`}
      />
      <section className="relative w-full max-w-sm">
        <div
          className={`relative mx-auto grid place-items-center rounded-[var(--radius-card)] bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20 ${
            immersive ? 'size-20' : 'size-14'
          }`}
        >
          <span className="absolute inset-0 animate-ping rounded-[var(--radius-card)] bg-[var(--color-brand)]/20 [animation-duration:2s]" />
          <span className="relative grid place-items-center" aria-hidden="true">
            {mark}
          </span>
        </div>
        <h1
          className={`mt-5 font-bold tracking-[-0.04em] ${immersive ? 'text-3xl' : 'text-2xl'}`}
        >
          {productName}
        </h1>
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
