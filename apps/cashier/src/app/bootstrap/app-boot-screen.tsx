import { Building2 } from 'lucide-react';

interface AppBootScreenProps {
  productName?: string;
  message?: string;
}

export function AppBootScreen({
  productName = 'Digvation Business',
  message = 'Preparing your workspace',
}: AppBootScreenProps) {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-6 text-center"
    >
      <div className="pointer-events-none absolute left-[12%] top-[18%] size-64 rounded-full bg-[var(--color-brand)]/[0.035] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[12%] right-[14%] size-56 rounded-full bg-[var(--color-accent-lavender)]/25 blur-3xl" />
      <section className="relative w-full max-w-sm">
        <div className="relative mx-auto grid size-14 place-items-center rounded-[var(--radius-card)] bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20">
          <span className="absolute inset-0 rounded-[var(--radius-card)] bg-[var(--color-brand)]/20 animate-ping [animation-duration:2s]" />
          <Building2 className="relative size-6" />
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
