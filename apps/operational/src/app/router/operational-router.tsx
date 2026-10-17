import { useAuth } from '@digvation/business-auth';
import { SystemStatePage } from '@digvation/business-system-states';
import { DButton } from '@digvation/ui';
import { Navigate, createBrowserRouter, useNavigate } from 'react-router';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../localization/operational-localization';
import { SellPage } from '../../routes/sell/sell-page';
import { OperationalShell } from '../shell/operational-shell';
import type { OperationalNavigationSection } from '../../shared/navigation/operational-navigation';
import { posSellOperationalNavigation } from '../../features/sell/pos-operational-navigation';
import { financeOperationalNavigation } from '../../features/expenses/finance-operational-navigation';
import { OperationalExpensesPage } from '../../features/expenses/operational-expenses-page';
import { customerOperationalNavigation, OperationalCustomersPage } from '../../features/customers';
import {
  canAccessOperationalExpenses,
  resolveOperationalSurfaceAccess,
} from '../../shared/operational-access/operational-surface-access';

export { canAccessOperationalExpenses };

function useOperationalSurfaceAccess() {
  const { session } = useAuth();
  return resolveOperationalSurfaceAccess(session.access);
}

function OperationalLayout() {
  const access = useOperationalSurfaceAccess();
  const { copy } = useOperationalLocalization();
  // Transaction history belongs to Backoffice; Operational only runs the sale.
  const salesItems = access.canSell ? posSellOperationalNavigation.items : [];
  const navigationSections: OperationalNavigationSection[] = [
    ...(salesItems.length
      ? [
          {
            label: copy(posSellOperationalNavigation.label),
            items: salesItems.map((item) => ({ ...item, label: copy(item.label) })),
          },
        ]
      : []),
    ...(access.canAccessCustomers
      ? [
          {
            label: copy(customerOperationalNavigation.label),
            items: customerOperationalNavigation.items.map((item) => ({
              ...item,
              label: copy(item.label),
            })),
          },
        ]
      : []),
    ...(access.canAccessExpenses
      ? [
          {
            label: copy(financeOperationalNavigation.label),
            items: financeOperationalNavigation.items.map((item) => ({
              ...item,
              label: copy(item.label),
            })),
          },
        ]
      : []),
  ];
  return <OperationalShell navigationSections={navigationSections} />;
}

function OperationalHome() {
  const access = useOperationalSurfaceAccess();
  return <Navigate to={access.home ?? '/login'} replace />;
}

const homeLabel = {
  '/sell': 'Go to Sell',
  '/expenses': 'Go to Expenses',
  '/customers': 'Go to Customers',
} as const;

export function OperationalNotFoundRoute() {
  const navigate = useNavigate();
  const access = useOperationalSurfaceAccess();
  const { copy } = useOperationalLocalization();
  const home = access.home;
  return (
    <SystemStatePage
      state="not-found"
      variant="content"
      action={
        home ? (
          <DButton variant="secondary" size="sm" onClick={() => navigate(home)}>
            {copy(homeLabel[home])}
          </DButton>
        ) : undefined
      }
    />
  );
}

function OperationalAccessDeniedRoute() {
  const navigate = useNavigate();
  const access = useOperationalSurfaceAccess();
  const { copy } = useOperationalLocalization();
  const home = access.home;
  return (
    <SystemStatePage
      state="forbidden"
      action={
        home ? (
          <DButton variant="secondary" size="sm" onClick={() => navigate(home)}>
            {copy(homeLabel[home])}
          </DButton>
        ) : undefined
      }
    />
  );
}

function OperationalApplicationErrorRoute() {
  return (
    <SystemStatePage
      state="application-error"
      action={
        <DButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Coba lagi
        </DButton>
      }
    />
  );
}

function SurfaceGate({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  return allowed ? <>{children}</> : <OperationalAccessDeniedRoute />;
}

function SellRoute() {
  const { canSell } = useOperationalSurfaceAccess();
  return (
    <SurfaceGate allowed={canSell}>
      <SellPage />
    </SurfaceGate>
  );
}

function ExpensesRoute() {
  const { canAccessExpenses } = useOperationalSurfaceAccess();
  return (
    <SurfaceGate allowed={canAccessExpenses}>
      <OperationalExpensesPage />
    </SurfaceGate>
  );
}

function CustomersRoute() {
  const { canAccessCustomers } = useOperationalSurfaceAccess();
  return (
    <SurfaceGate allowed={canAccessCustomers}>
      <OperationalCustomersPage />
    </SurfaceGate>
  );
}

export const operationalRouter = createBrowserRouter([
  { path: '/login', element: <Navigate to="/" replace /> },
  {
    element: <OperationalLayout />,
    errorElement: <OperationalApplicationErrorRoute />,
    children: [
      { index: true, element: <OperationalHome /> },
      { path: '/sell', element: <SellRoute /> },
      { path: '/sell/:saleId', element: <SellRoute /> },
      { path: '/expenses', element: <ExpensesRoute /> },
      { path: '/customers', element: <CustomersRoute /> },
      { path: '/members', element: <Navigate to="/customers" replace /> },
      { path: '*', element: <OperationalNotFoundRoute /> },
    ],
  },
]);
