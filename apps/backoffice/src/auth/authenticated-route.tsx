import { Navigate, Outlet, useLocation } from 'react-router';

import { useBackofficeAuth } from './backoffice-auth-context';
import { BackofficeLoginPage } from './backoffice-login-page';

export function AuthenticatedRoute() {
  const location = useLocation();
  const { status } = useBackofficeAuth();
  if (status === 'hydrating') return null;
  if (status === 'unavailable') return <BackofficeLoginPage />;
  if (status === 'unauthenticated')
    // Keep the sign-in surface painted while the redirect commits, avoiding an empty frame.
    return (
      <>
        <BackofficeLoginPage />
        <Navigate to="/login" replace state={{ from: location.pathname }} />
      </>
    );
  return <Outlet />;
}
