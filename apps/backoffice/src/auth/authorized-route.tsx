import { Navigate, Outlet } from 'react-router';

import { canAccessBackoffice, type BackofficeCapability } from './backoffice-access';
import { useBackofficeAuth } from './backoffice-auth-context';

export function AuthorizedRoute({ capability }: { capability: BackofficeCapability }) {
  const { session } = useBackofficeAuth();
  if (!session || !canAccessBackoffice(session, capability))
    return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
