import React from 'react';
import ReactDOM from 'react-dom/client';

import '@digvation/ui/styles.css';
import './app/app.css';

import { AppBootScreen } from './app/bootstrap/app-boot-screen';
import { BootstrapTransition } from './app/bootstrap/bootstrap-transition';
import { bootstrapOperational } from './app/bootstrap/bootstrap-operational';

function renderBootstrapFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown startup error';

  root.render(
    <React.StrictMode>
      <main className="grid min-h-screen place-items-center p-6">
        <section className="max-w-lg rounded-2xl border border-(--color-border) bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-(--color-danger)">
            Startup blocked
          </p>
          <h1 className="mt-3 text-xl font-bold">Digvation Business could not initialize.</h1>
          <p className="mt-3 text-sm leading-6 text-(--color-text-muted)">{message}</p>
        </section>
      </main>
    </React.StrictMode>,
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <AppBootScreen />
  </React.StrictMode>,
);

void bootstrapOperational()
  .then((app) => {
    root.render(
      <React.StrictMode>
        <BootstrapTransition>{app}</BootstrapTransition>
      </React.StrictMode>,
    );
  })
  .catch(renderBootstrapFailure);
