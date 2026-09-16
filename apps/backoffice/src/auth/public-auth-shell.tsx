import { useDeploymentBootstrap } from '@digvation/business-runtime';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function PublicAuthShell({
  title,
  description,
  children,
  showLoginLink = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  showLoginLink?: boolean;
}) {
  const bootstrap = useDeploymentBootstrap();

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-4 py-8 sm:grid sm:place-items-center sm:px-6 sm:py-12">
      <section className="mx-auto w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-8">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            {bootstrap.branding.productName}
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-text)]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
          ) : null}
        </div>

        {children}

        {showLoginLink ? (
          <div className="mt-6 border-t border-[var(--color-border)] pt-5 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-[var(--color-brand)] hover:underline"
            >
              Kembali ke halaman masuk
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
