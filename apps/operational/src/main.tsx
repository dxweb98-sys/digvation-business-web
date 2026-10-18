import React from 'react';
import ReactDOM from 'react-dom/client';

import { SystemStatePage } from '@digvation/business-system-states';
import { DButton } from '@digvation/ui';

import '@digvation/ui/styles.css';
import './app/app.css';

import { bootstrapOperational } from './app/bootstrap/bootstrap-operational';
import { OperationalStartup } from './app/bootstrap/operational-startup';

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

const startup = bootstrapOperational();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OperationalStartup startup={startup} renderFailure={() => <BootstrapFailure />} />
  </React.StrictMode>,
);
