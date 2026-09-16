import { DButton } from '@digvation/ui';
import { Navigate, Outlet, useLocation } from 'react-router';

import { AuthenticationLoading } from './authentication-loading';
import { useBackofficeAuth } from './backoffice-auth-context';

export function AuthenticatedRoute() {
  const location = useLocation();
  const { status, refreshSessionContext } = useBackofficeAuth();
  if (status === 'hydrating') return <AuthenticationLoading />;
  if (status === 'unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
        <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-lg font-semibold">Service unavailable</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Unable to load your current session. Please try again.
          </p>
          <DButton className="mt-5" onClick={() => void refreshSessionContext()}>
            Try again
          </DButton>
        </section>
      </main>
    );
  }
  if (status === 'unauthenticated')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
