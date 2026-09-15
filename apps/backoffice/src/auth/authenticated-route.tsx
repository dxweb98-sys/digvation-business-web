import { Navigate, Outlet, useLocation } from 'react-router';

import { AuthenticationLoading } from './authentication-loading';
import { useBackofficeAuth } from './backoffice-auth-context';

export function AuthenticatedRoute() {
  const location = useLocation();
  const { status } = useBackofficeAuth();
  if (status === 'hydrating') return <AuthenticationLoading />;
  if (status === 'unauthenticated')
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
