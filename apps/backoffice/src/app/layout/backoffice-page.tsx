import type { ReactNode } from 'react';

interface BackofficePageProps {
  children: ReactNode;
}

interface BackofficePageHeaderProps {
  eyebrow?: string | undefined;
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
}

export function BackofficePage({ children }: BackofficePageProps) {
  return <section className="px-5 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</section>;
}

export function BackofficePageHeader({ eyebrow, title, description, actions }: BackofficePageHeaderProps) {
  return <div className="flex flex-wrap items-end justify-between gap-4"><div>{eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">{eyebrow}</p> : null}<h1 className={eyebrow ? 'mt-2 text-2xl font-bold tracking-[-0.02em]' : 'text-2xl font-bold tracking-[-0.02em]'}>{title}</h1>{description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">{description}</p> : null}</div>{actions}</div>;
}
