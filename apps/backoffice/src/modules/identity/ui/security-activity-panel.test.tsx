import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { PasswordResetChallenge } from '../access-control-api';
import { SecurityActivityPanel } from './security-activity-panel';

vi.mock('../../../auth/backoffice-auth-context', () => ({
  isSessionExpiredError: () => false,
  useBackofficeAuth: () => ({ status: 'authenticated', session: null }),
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const challenge = (overrides: Partial<PasswordResetChallenge>): PasswordResetChallenge => ({
  id: 'c-1',
  status: 'PENDING',
  requestedAt: '2026-10-15T08:00:00.000Z',
  expiresAt: '2026-10-18T08:00:00.000Z',
  resendAvailableAt: '2026-10-15T08:01:00.000Z',
  requestedVia: 'ADMIN',
  requestedBy: 'Owner Salon',
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  supersededAt: null,
  replacedByChallengeId: null,
  deliveryFailedAt: null,
  ...overrides,
});

function renderPanel(
  items: PasswordResetChallenge[],
  options: { canCancel?: boolean; cancel?: ReturnType<typeof vi.fn> } = {},
) {
  const api = {
    listPasswordResets: vi.fn().mockResolvedValue(items),
    cancelPasswordReset: options.cancel ?? vi.fn().mockResolvedValue({}),
  };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DeploymentBootstrapProvider config={bootstrap}>
        <DToastProvider>
          <BackofficeLocalizationProvider>
            <SecurityActivityPanel
              userId="u-1"
              api={api as never}
              canCancel={options.canCancel ?? true}
            />
          </BackofficeLocalizationProvider>
        </DToastProvider>
      </DeploymentBootstrapProvider>
    </QueryClientProvider>,
  );
  return api;
}

const text = () => document.body.textContent ?? '';
const button = (name: string) =>
  [...document.body.querySelectorAll('button')].find((node) => node.textContent === name);
const press = async (node: Element | undefined) => {
  await act(async () => {
    fireEvent.click(node!);
  });
};

afterEach(cleanup);

describe('SecurityActivityPanel', () => {
  it('shows each challenge state with safe metadata and no credential', async () => {
    renderPanel([
      challenge({ id: 'c-3', status: 'PENDING' }),
      challenge({ id: 'c-2', status: 'SUPERSEDED', supersededAt: '2026-10-15T08:00:00.000Z' }),
      challenge({
        id: 'c-1',
        status: 'COMPLETED',
        completedAt: '2026-10-14T09:00:00.000Z',
        requestedVia: 'SELF',
      }),
    ]);
    await waitFor(() => expect(text()).toContain('Menunggu pengguna'));
    expect(text()).toContain('Diajukan oleh Owner Salon');
    expect(text()).toContain('Digantikan');
    expect(text()).toContain('Kata sandi diatur');
    expect(text()).toContain('Diminta oleh pengguna');
    expect(text()).not.toMatch(/token|https?:\/\//i);
  });

  it('offers cancel only for open links, asks first and reports the outcome', async () => {
    const cancel = vi.fn().mockResolvedValue({});
    renderPanel(
      [challenge({ id: 'c-2', status: 'PENDING' }), challenge({ id: 'c-1', status: 'EXPIRED' })],
      { cancel },
    );
    await waitFor(() => expect(text()).toContain('Menunggu pengguna'));
    expect(
      [...document.body.querySelectorAll('button')].filter(
        (node) => node.textContent === 'Batalkan tautan',
      ),
    ).toHaveLength(1);
    await press(button('Batalkan tautan'));
    expect(cancel).not.toHaveBeenCalled();
    expect(text()).toContain('Batalkan tautan kata sandi ini?');
    const confirm = [...document.body.querySelectorAll('button')].filter(
      (node) => node.textContent === 'Batalkan tautan',
    );
    await press(confirm[confirm.length - 1]);
    await waitFor(() => expect(cancel).toHaveBeenCalledWith('u-1', 'c-2'));
  });

  it('hides cancel without permission and explains a refused delivery', async () => {
    renderPanel(
      [challenge({ status: 'DELIVERY_FAILED', deliveryFailedAt: '2026-10-15T08:00:05.000Z' })],
      {
        canCancel: false,
      },
    );
    await waitFor(() => expect(text()).toContain('Tidak terkirim'));
    expect(button('Batalkan tautan')).toBeUndefined();
    expect(text()).toContain('Penyedia pesan tidak menerima tautan ini');
  });
});
