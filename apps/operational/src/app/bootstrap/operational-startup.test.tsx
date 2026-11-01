import type { DeploymentBootstrapConfig } from '@digvation/business-runtime';
import { act, cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OperationalStartup,
  OperationalStartupSplash,
  remainingSplashTime,
  SPLASH_MINIMUM_VISIBLE_MS,
} from './operational-startup';

afterEach(cleanup);

const splashBootstrap: DeploymentBootstrapConfig = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'digvation-demo' },
  applications: { operational: true, backoffice: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
};

describe('remainingSplashTime', () => {
  it('waits only for the unused part of the minimum visible duration', () => {
    expect(remainingSplashTime(1_000, 1_100, 450)).toBe(350);
    expect(remainingSplashTime(1_000, 2_000, 450)).toBe(0);
  });
});

describe('OperationalStartupSplash', () => {
  it('reserves the product line before deployment bootstrap resolves', () => {
    const { container } = render(<OperationalStartupSplash bootstrap={null} />);

    expect(within(container).queryByText('Menyiapkan Operational')).not.toBeNull();
    expect(within(container).getByRole('heading', { level: 1 }).textContent).toBe(' ');
  });

  it('names the declared POS Salon application while preparing', () => {
    const { container } = render(
      <OperationalStartupSplash
        bootstrap={{ ...splashBootstrap, operationalApplication: 'POS_SALON_APP' }}
      />,
    );

    expect(within(container).queryByText('Menyiapkan POS Salon')).not.toBeNull();
    expect(within(container).queryByText('Menyiapkan Operational')).toBeNull();
  });

  it('keeps the legacy Operational name when no application identity is declared', () => {
    const { container } = render(<OperationalStartupSplash bootstrap={splashBootstrap} />);

    expect(within(container).queryByText('Menyiapkan Operational')).not.toBeNull();
  });
});

describe('OperationalStartup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts the application as soon as it is ready and fades the splash after the minimum', async () => {
    vi.useFakeTimers();
    const application = Promise.resolve(<p>Application</p>);
    const bootstrap = new Promise<never>(() => undefined);

    const { container } = render(
      <OperationalStartup
        startup={{ bootstrap, application }}
        renderFailure={() => <p>Failed</p>}
      />,
    );
    await act(async () => {
      await application;
    });

    expect(within(container).queryByText('Application')).not.toBeNull();
    expect(container.querySelector('.operational-startup-splash')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SPLASH_MINIMUM_VISIBLE_MS);
    });
    expect(container.querySelector('.operational-startup-splash--leaving')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector('.operational-startup-splash')).toBeNull();
  });

  it('replaces the splash with the startup failure view', async () => {
    const application = Promise.reject(new Error('bootstrap unavailable'));
    const bootstrap = new Promise<never>(() => undefined);

    const { container } = render(
      <OperationalStartup
        startup={{ bootstrap, application }}
        renderFailure={() => <p>Failed</p>}
      />,
    );
    await act(async () => {
      await application.catch(() => undefined);
    });

    expect(within(container).queryByText('Failed')).not.toBeNull();
    expect(container.querySelector('.operational-startup-splash')).toBeNull();
  });
});
