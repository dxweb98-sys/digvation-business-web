import { useAuth } from '@digvation/business-auth';
import { Navigate, createBrowserRouter } from 'react-router';
import type { ReactNode } from 'react';

import { useOperationalLocalization } from '../localization/operational-localization';
import { SellPage } from '../../routes/sell/sell-page';
import { OperationalShell } from '../../modules/operational/operational-shell';
import type { OperationalNavigationSection } from '../../modules/operational/operational-navigation';
import { posSellOperationalNavigation } from '../../modules/pos/pos-operational-navigation';
import { financeOperationalNavigation } from '../../modules/finance/finance-operational-navigation';
import { OperationalExpensesPage } from '../../modules/finance/operational-expenses-page';

function useOperationalSurfaceAccess() {
  const { session } = useAuth();
  const permissions = session.access.permissions;
  const hasPos = session.access.products.includes('POS');
  const hasFinance = session.access.capabilities.includes('FINANCE_OPERATIONS');
  return {
    canSell: hasPos && permissions.includes('sales:create'),
    canReadExpenses:
      hasFinance &&
      (permissions.includes('expenses:read') || permissions.includes('expenses:read-own')),
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
    ...(access.canReadExpenses
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
  if (access.canReadExpenses) return <Navigate to="/expenses" replace />;
  return <Navigate to="/login" replace />;
}

function SurfaceGate({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  return allowed ? <>{children}</> : <OperationalHome />;
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
  const { canReadExpenses } = useOperationalSurfaceAccess();
  return (
    <SurfaceGate allowed={canReadExpenses}>
      <OperationalExpensesPage />
    </SurfaceGate>
  );
}

export const operationalRouter = createBrowserRouter([
  { path: '/login', element: <Navigate to="/" replace /> },
  {
    element: <OperationalLayout />,
    children: [
      { index: true, element: <OperationalHome /> },
      { path: '/sell', element: <SellRoute /> },
      { path: '/sell/:saleId', element: <SellRoute /> },
      { path: '/expenses', element: <ExpensesRoute /> },
      // Retired or unknown paths, such as the former transaction history, land on the home redirect.
      { path: '*', element: <OperationalHome /> },
    ],
  },
]);
