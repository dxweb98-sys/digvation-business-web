import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import { BackofficePasswordLinkDialog } from './backoffice-password-link-dialog';

const getAccessToken = vi.fn().mockResolvedValue('access-token');
vi.mock('./backoffice-auth-context', () => ({ useBackofficeAuth: () => ({ getAccessToken }) }));
const bootstrap = {
  apiBaseUrl: 'http://runtime.test',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;
const renderDialog = () =>
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <BackofficePasswordLinkDialog open onClose={vi.fn()} />
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BackofficePasswordLinkDialog', () => {
  it('offers only a verified-email password link', () => {
    renderDialog();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.getByText('Kirim tautan kata sandi baru')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kirim tautan' })).toBeTruthy();
  });
  it('requests the authenticated user password link and confirms email delivery', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim tautan' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'http://runtime.test/api/v1/auth/password-change/request',
    );
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  });
  it('shows cooldown without claiming success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: { code: 'PASSWORD_RESET_COOLDOWN' } }),
        }),
    );
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Kirim tautan' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
