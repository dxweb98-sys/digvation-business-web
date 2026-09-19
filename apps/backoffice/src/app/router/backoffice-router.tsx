import { createBrowserRouter } from 'react-router';

import { AuthenticatedRoute } from '../../auth/authenticated-route';
import { AuthorizedRoute } from '../../auth/authorized-route';
import { BackofficeLoginPage, PASSWORD_RECOVERY_PATH } from '../../auth/backoffice-login-page';
import { BackofficePasswordRecoveryPage } from '../../auth/backoffice-password-recovery-page';
import { UnauthorizedPage } from '../../routes/authorization/unauthorized-page';
import { DashboardPage } from '../../modules/dashboard/dashboard-page';
import { BackofficeShell } from '../shell/backoffice-shell';
import { AccessControlPage } from '../../modules/identity';
import { BusinessSettingsPage } from '../../modules/organization';
import { CatalogPage } from '../../modules/catalog';
import { PromotionsPage } from '../../modules/promotions';
import { EmployeesPage } from '../../modules/workforce';
import { ExpensesPage, FinancialAccountsPage } from '../../modules/finance';
import { TransactionHistoryPage } from '../../modules/pos';
import { ReportsPage } from '../../modules/reporting';
import { ActivityPage } from '../../modules/activity';
import { NotificationsPage } from '../../modules/notifications';

export const backofficeRouter = createBrowserRouter([
  { path: '/login', element: <BackofficeLoginPage /> },
  { path: PASSWORD_RECOVERY_PATH, element: <BackofficePasswordRecoveryPage /> },
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
            element: <AuthorizedRoute capability="promotions" />,
            children: [{ path: '/promotions', element: <PromotionsPage /> }],
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
            element: <AuthorizedRoute capability="activity" />,
            children: [{ path: '/activity', element: <ActivityPage /> }],
          },
          {
            element: <AuthorizedRoute capability="accessControl" />,
            children: [{ path: '/access-control', element: <AccessControlPage /> }],
          },
          { path: '/notifications', element: <NotificationsPage /> },
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
