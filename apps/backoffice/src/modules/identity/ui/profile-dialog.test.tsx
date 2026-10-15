import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import { ProfileDialog } from './profile-dialog';

const client = { get: vi.fn(), patch: vi.fn() };
const refreshSessionContext = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../auth/backoffice-auth-context', () => ({
  isSessionExpiredError: () => false,
  useBackofficeAuth: () => ({
    status: 'authenticated',
    session: null,
    createApiClient: () => client,
    refreshSessionContext,
  }),
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

const self = (systemKey: 'OWNER' | null) => ({
  id: 'u-1',
  username: 'siti.rahma',
  displayName: 'Siti Rahma',
  phoneE164: '+628123456789',
  version: 2,
  roles: [
    { id: 'r-1', code: systemKey ?? 'STAFF', name: systemKey ? 'Owner' : 'Staff', systemKey },
  ],
});

function renderDialog() {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeploymentBootstrapProvider config={bootstrap}>
        <DToastProvider>
          <BackofficeLocalizationProvider>
            <ProfileDialog open onClose={onClose} />
          </BackofficeLocalizationProvider>
        </DToastProvider>
      </DeploymentBootstrapProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const field = (label: RegExp) => {
  const match = [...document.body.querySelectorAll('label')].find((node) =>
    label.test(node.textContent ?? ''),
  );
  return document.getElementById(match?.getAttribute('for') ?? '') as HTMLInputElement;
};
const save = async () => {
  const target = [...document.body.querySelectorAll('button')].find(
    (node) => node.textContent === 'Simpan perubahan',
  )!;
  await act(async () => {
    fireEvent.click(target);
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe.each([
  ['non-Owner', null],
  ['Owner', 'OWNER' as const],
])('ProfileDialog (%s)', (_label, systemKey) => {
  it('shows the account, keeps the phone read-only and sends only changed fields', async () => {
    client.get.mockResolvedValue(self(systemKey));
    client.patch.mockResolvedValue(self(systemKey));
    const { onClose } = renderDialog();
    await waitFor(() => expect(field(/Nama tampilan/)?.value).toBe('Siti Rahma'));
    expect(field(/Nomor telepon terverifikasi/).value).toBe('+628123456789');
    expect(field(/Nomor telepon terverifikasi/).disabled).toBe(true);
    fireEvent.change(field(/Nama tampilan/), { target: { value: ' Siti R ' } });
    await save();
    await waitFor(() => expect(client.patch).toHaveBeenCalledTimes(1));
    expect(client.patch).toHaveBeenCalledWith('/api/v1/auth/me', { displayName: 'Siti R' });
    await waitFor(() => expect(refreshSessionContext).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows a username conflict under the field and never sends invalid names', async () => {
    client.get.mockResolvedValue(self(systemKey));
    client.patch.mockRejectedValue({ status: 409, code: 'USER_USERNAME_ALREADY_EXISTS' });
    const { onClose } = renderDialog();
    await waitFor(() => expect(field(/Username masuk/)?.value).toBe('siti.rahma'));
    fireEvent.change(field(/Username masuk/), { target: { value: 'x' } });
    await save();
    expect(client.patch).not.toHaveBeenCalled();
    fireEvent.change(field(/Username masuk/), { target: { value: 'taken.name' } });
    await save();
    await waitFor(() => expect(document.body.textContent).toContain('sudah dipakai'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
