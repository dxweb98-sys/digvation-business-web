import { createBrowserRouter } from 'react-router';

import { AuthenticatedRoute } from '../../auth/authenticated-route';
import { AuthorizedRoute } from '../../auth/authorized-route';
import { BackofficeLoginPage } from '../../auth/backoffice-login-page';
import { UnauthorizedPage } from '../../routes/authorization/unauthorized-page';
import { DashboardPage } from '../../modules/dashboard/dashboard-page';
import { BackofficeShell } from '../shell/backoffice-shell';
import { AccessControlPage } from '../../modules/identity';
import { BusinessSettingsPage } from '../../modules/organization';
import { CatalogPage } from '../../modules/catalog';
import { TaxPage } from '../../modules/tax';
import { EmployeesPage } from '../../modules/workforce';
import {
  ExpensesPage,
  FinancialAccountsPage,
  FinancialOperationsPage,
} from '../../modules/finance';
import { TransactionHistoryPage } from '../../modules/pos';
import { ReportsPage } from '../../modules/reporting';

export const backofficeRouter = createBrowserRouter([
  { path: '/login', element: <BackofficeLoginPage /> },
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        element: <BackofficeShell />,
        children: [
          {
            element: <AuthorizedRoute capability="dashboard" />,
            children: [{ index: true, element: <DashboardPage /> }],
          },
          {
            element: <AuthorizedRoute capability="catalog" />,
            children: [{ path: '/catalog', element: <CatalogPage /> }],
          },
          {
            element: <AuthorizedRoute capability="employees" />,
            children: [{ path: '/employees', element: <EmployeesPage /> }],
          },
          {
            element: <AuthorizedRoute capability="financialAccounts" />,
            children: [
              {
                path: '/financial-accounts',
                element: <FinancialAccountsPage />,
              },
            ],
          },
          {
            element: <AuthorizedRoute capability="expenses" />,
            children: [{ path: '/expenses', element: <ExpensesPage /> }],
          },
          {
            element: <AuthorizedRoute capability="financialOperations" />,
            children: [{ path: '/reconciliation', element: <FinancialOperationsPage /> }],
          },
          {
            element: <AuthorizedRoute capability="reports" />,
            children: [{ path: '/reports', element: <ReportsPage /> }],
          },
          {
            element: <AuthorizedRoute capability="transactions" />,
            children: [{ path: '/transactions', element: <TransactionHistoryPage /> }],
          },
          {
            element: <AuthorizedRoute capability="configuration" />,
            children: [{ path: '/business', element: <BusinessSettingsPage /> }],
          },
          {
            element: <AuthorizedRoute capability="tax" />,
            children: [{ path: '/tax', element: <TaxPage /> }],
          },
          {
            element: <AuthorizedRoute capability="accessControl" />,
            children: [{ path: '/access-control', element: <AccessControlPage /> }],
          },
          { path: '/unauthorized', element: <UnauthorizedPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <BackofficeLoginPage />,
  },
]);
