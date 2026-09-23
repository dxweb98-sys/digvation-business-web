import React from 'react';
import ReactDOM from 'react-dom/client';

import { SystemStatePage } from '@digvation/business-system-states';
import { DButton } from '@digvation/ui';

import '@digvation/ui/styles.css';
import './app/app.css';

import { bootstrapBackoffice } from './app/bootstrap/bootstrap-backoffice';
import { BackofficeStartup } from './app/bootstrap/backoffice-startup';

function BootstrapFailure() {
  return (
    <SystemStatePage
      state="service-unavailable"
      action={
        <DButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Coba lagi
        </DButton>
      }
    />
  );
}

const startup = bootstrapBackoffice();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BackofficeStartup startup={startup} renderFailure={() => <BootstrapFailure />} />
  </React.StrictMode>,
);
