import { createBrowserRouter } from 'react-router';

import { AuthenticatedRoute } from '../../auth/authenticated-route';
import { AuthorizedRoute } from '../../auth/authorized-route';
import { BackofficeLoginPage } from '../../auth/backoffice-login-page';
import { UnauthorizedPage } from '../../routes/authorization/unauthorized-page';
import { AccessControlPage } from '../../routes/access-control/access-control-page';
import { DashboardPage } from '../../routes/dashboard/dashboard-page';
import { PlaceholderPage } from '../../routes/placeholder/placeholder-page';
import { BackofficeShell } from '../shell/backoffice-shell';
import { BusinessSettingsPage } from '../../routes/business-settings/business-settings-page';
import { CatalogPage } from '../../routes/catalog/catalog-page';
import { TaxPage } from '../../routes/tax/tax-page';
import { EmployeesPage } from '../../routes/employees/employees-page';
import { FinancialAccountsPage } from '../../routes/financial-accounts/financial-accounts-page';
import { FinancialOperationsPage } from '../../routes/financial-operations/financial-operations-page';
import { ExpensesPage } from '../../routes/expenses/expenses-page';

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
            children: [
              { path: '/expenses', element: <ExpensesPage /> },
            ],
          },
          {
            element: <AuthorizedRoute capability="financialOperations" />,
            children: [{ path: '/reconciliation', element: <FinancialOperationsPage /> }],
          },
          {
            element: <AuthorizedRoute capability="reports" />,
            children: [{ path: '/reports', element: <PlaceholderPage title="reports" /> }],
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
