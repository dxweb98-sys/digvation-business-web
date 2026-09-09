import { Navigate, createBrowserRouter } from 'react-router';

import { OpenSalesPage } from '../../routes/open-sales/open-sales-page';
import { SellPage } from '../../routes/sell/sell-page';
import { CashierShell } from '../../app/shell/cashier-shell';

export const posOperationalRouter = createBrowserRouter([
  { path: '/login', element: <Navigate to="/sell" replace /> },
  {
    element: <CashierShell />,
    children: [
      { index: true, element: <Navigate to="/sell" replace /> },
      { path: '/sell', element: <SellPage /> },
      { path: '/sell/:saleId', element: <SellPage /> },
      { path: '/open-sales', element: <OpenSalesPage /> },
    ],
  },
]);
