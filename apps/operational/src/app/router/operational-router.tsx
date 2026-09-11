import { Navigate, createBrowserRouter } from 'react-router';

import { OpenSalesPage } from '../../routes/open-sales/open-sales-page';
import { SellPage } from '../../routes/sell/sell-page';
import { OperationalShell } from '../../modules/operational/operational-shell';
import { posOperationalNavigation } from '../../modules/pos/pos-operational-navigation';

export const operationalRouter = createBrowserRouter([
  { path: '/login', element: <Navigate to="/sell" replace /> },
  {
    element: <OperationalShell navigationSections={posOperationalNavigation} />,
    children: [
      { index: true, element: <Navigate to="/sell" replace /> },
      { path: '/sell', element: <SellPage /> },
      { path: '/sell/:saleId', element: <SellPage /> },
      { path: '/open-sales', element: <OpenSalesPage /> },
    ],
  },
]);
