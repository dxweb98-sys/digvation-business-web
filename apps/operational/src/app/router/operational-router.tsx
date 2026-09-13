import { Navigate, createBrowserRouter } from 'react-router';
import type { ReactNode } from 'react';

import { useOperationalAvailability } from '../providers/operational-availability-context';
import { SellPage } from '../../routes/sell/sell-page';
import { OperationalShell } from '../../modules/operational/operational-shell';
import type { OperationalNavigationSection } from '../../modules/operational/operational-navigation';
import {
  posHistoryOperationalNavigation,
  posSellOperationalNavigation,
} from '../../modules/pos/pos-operational-navigation';
import { OperationalTransactionHistoryPage } from '../../modules/pos/operational-transaction-history-page';
import { financeOperationalNavigation } from '../../modules/finance/finance-operational-navigation';
import { OperationalExpensesPage } from '../../modules/finance/operational-expenses-page';

function useOperationalSurfaceAccess() {
  const availability = useOperationalAvailability();
  const permissions = availability.effectivePermissions;
  const hasPos = availability.effectiveEntitlements.products.includes('POS');
  const hasFinance =
    availability.effectiveEntitlements.capabilities.includes('FINANCE_OPERATIONS');
  return {
    canSell: hasPos && permissions.includes('sales:create'),
    canReadSales: hasPos && permissions.includes('sales:read'),
    canReadExpenses:
      hasFinance &&
      (permissions.includes('expenses:read') || permissions.includes('expenses:read-own')),
  };
}

function OperationalLayout() {
  const access = useOperationalSurfaceAccess();
  const salesItems = [
    ...(access.canSell ? posSellOperationalNavigation.items : []),
    ...(access.canReadSales ? posHistoryOperationalNavigation.items : []),
  ];
  const navigationSections: OperationalNavigationSection[] = [
    ...(salesItems.length
      ? [{ label: posSellOperationalNavigation.label, items: salesItems }]
      : []),
    ...(access.canReadExpenses ? [financeOperationalNavigation] : []),
  ];
  return <OperationalShell navigationSections={navigationSections} />;
}

function OperationalHome() {
  const access = useOperationalSurfaceAccess();
  if (access.canSell) return <Navigate to="/sell" replace />;
  if (access.canReadSales) return <Navigate to="/transactions" replace />;
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

function TransactionHistoryRoute() {
  const { canReadSales } = useOperationalSurfaceAccess();
  return (
    <SurfaceGate allowed={canReadSales}>
      <OperationalTransactionHistoryPage />
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
      { path: '/transactions', element: <TransactionHistoryRoute /> },
      { path: '/expenses', element: <ExpensesRoute /> },
    ],
  },
]);
