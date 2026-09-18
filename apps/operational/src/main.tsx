import React from 'react';
import ReactDOM from 'react-dom/client';

import '@digvation/ui/styles.css';
import './app/app.css';

import { bootstrapOperational } from './app/bootstrap/bootstrap-operational';
import { OperationalStartup } from './app/bootstrap/operational-startup';

function BootstrapFailure({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-lg rounded-2xl border border-(--color-border) bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--color-danger)">
          Startup blocked
        </p>
        <h1 className="mt-3 text-xl font-bold">Digvation Business could not initialize.</h1>
        <p className="mt-3 text-sm leading-6 text-(--color-text-muted)">{message}</p>
      </section>
    </main>
  );
}

const startup = bootstrapOperational();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OperationalStartup
      startup={startup}
      renderFailure={(error) => <BootstrapFailure error={error} />}
    />
  </React.StrictMode>,
);
