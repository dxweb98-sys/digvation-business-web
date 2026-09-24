import { useAuth } from '@digvation/business-auth';
import { SystemStatePage } from '@digvation/business-system-states';
import { DButton } from '@digvation/ui';
import { Navigate, createBrowserRouter, useNavigate } from 'react-router';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../localization/operational-localization';
import { SellPage } from '../../routes/sell/sell-page';
import { OperationalShell } from '../../modules/operational/operational-shell';
import type { OperationalNavigationSection } from '../../modules/operational/operational-navigation';
import { posSellOperationalNavigation } from '../../modules/pos/pos-operational-navigation';
import { financeOperationalNavigation } from '../../modules/finance/finance-operational-navigation';
import { OperationalExpensesPage } from '../../modules/finance/operational-expenses-page';

export function canAccessOperationalExpenses(
  permissions: readonly string[],
  hasFinanceOperations: boolean,
) {
  return (
    hasFinanceOperations &&
    (permissions.includes('expenses:read') ||
      permissions.includes('expenses:read-own') ||
      permissions.includes('expenses:create'))
  );
}

function useOperationalSurfaceAccess() {
  const { session } = useAuth();
  const permissions = session.access.permissions;
  const hasPos = session.access.products.includes('POS');
  const hasFinance = session.access.capabilities.includes('FINANCE_OPERATIONS');
  return {
    canSell: hasPos && permissions.includes('sales:create'),
    canAccessExpenses: canAccessOperationalExpenses(permissions, hasFinance),
  };
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
  if (access.canSell) return <Navigate to="/sell" replace />;
  if (access.canAccessExpenses) return <Navigate to="/expenses" replace />;
  return <Navigate to="/login" replace />;
}

export function OperationalNotFoundRoute() {
  const navigate = useNavigate();
  return (
    <SystemStatePage
      state="not-found"
      variant="content"
      action={
        <DButton variant="secondary" size="sm" onClick={() => navigate('/')}>
          Kembali ke Jual
        </DButton>
      }
    />
  );
}

function OperationalAccessDeniedRoute() {
  const navigate = useNavigate();
  return (
    <SystemStatePage
      state="forbidden"
      action={
        <DButton variant="secondary" size="sm" onClick={() => navigate('/')}>
          Kembali ke Jual
        </DButton>
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
      { path: '*', element: <OperationalNotFoundRoute /> },
    ],
  },
]);
