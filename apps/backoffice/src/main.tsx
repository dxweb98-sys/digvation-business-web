import React from 'react';
import ReactDOM from 'react-dom/client';

import '@digvation/ui/styles.css';
import './app/app.css';

import { bootstrapBackoffice } from './app/bootstrap/bootstrap-backoffice';
import { BackofficeStartup } from './app/bootstrap/backoffice-startup';

function BootstrapFailure({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="max-w-lg rounded-2xl border border-(--color-border) bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--color-danger)">
          Startup blocked
        </p>
        <h1 className="mt-3 text-xl font-bold">Backoffice could not initialize.</h1>
        <p className="mt-3 text-sm leading-6 text-(--color-text-muted)">{message}</p>
      </section>
    </main>
  );
}

const startup = bootstrapBackoffice();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BackofficeStartup
      startup={startup}
      renderFailure={(error) => <BootstrapFailure error={error} />}
    />
  </React.StrictMode>,
);
