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
  email: 'siti@example.com',
  emailVerifiedAt: '2026-10-18T00:00:00.000Z',
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
const openEditor = async () => {
  const target = await waitFor(() => {
    const button = [...document.body.querySelectorAll('button')].find((node) =>
      /Ubah profil/.test(node.textContent ?? ''),
    );
    expect(button).toBeTruthy();
    return button!;
  });
  await act(async () => {
    fireEvent.click(target);
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ProfileDialog (Owner)', () => {
  const systemKey = 'OWNER' as const;
  it('opens on a read-only account overview and enters edit mode only on request', async () => {
    client.get.mockResolvedValue(self(systemKey));
    renderDialog();

    await waitFor(() => expect(document.body.textContent).toContain('siti@example.com'));
    expect(field(/Nama tampilan/)).toBeNull();

    fireEvent.click(
      [...document.body.querySelectorAll('button')].find((node) =>
        /Ubah profil/.test(node.textContent ?? ''),
      )!,
    );

    await waitFor(() => expect(field(/Nama tampilan/)?.value).toBe('Siti Rahma'));
  });

  it('shows the account, keeps the phone read-only and sends only changed fields', async () => {
    client.get.mockResolvedValue(self(systemKey));
    client.patch.mockResolvedValue(self(systemKey));
    const { onClose } = renderDialog();
    await openEditor();
    await waitFor(() => expect(field(/Nama tampilan/)?.value).toBe('Siti Rahma'));
    expect(field(/Nomor telepon terverifikasi/).value).toBe('+628123456789');
    expect(field(/Nomor telepon terverifikasi/).disabled).toBe(true);
    expect(field(/Email/).value).toBe('siti@example.com');
    fireEvent.change(field(/Nama tampilan/), { target: { value: ' Siti R ' } });
    await save();
    await waitFor(() => expect(client.patch).toHaveBeenCalledTimes(1));
    expect(client.patch).toHaveBeenCalledWith('/api/v1/auth/me', { displayName: 'Siti R' });
    await waitFor(() => expect(refreshSessionContext).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('saves a changed email as unverified account data', async () => {
    client.get.mockResolvedValue(self(systemKey));
    client.patch.mockResolvedValue({
      ...self(systemKey),
      email: 'baru@example.com',
      emailVerifiedAt: null,
    });
    renderDialog();
    await openEditor();
    await waitFor(() => expect(field(/Email/).value).toBe('siti@example.com'));
    fireEvent.change(field(/Email/), { target: { value: 'baru@example.com' } });
    await save();
    await waitFor(() =>
      expect(client.patch).toHaveBeenCalledWith('/api/v1/auth/me', { email: 'baru@example.com' }),
    );
  });

  it('shows a username conflict under the field and never sends invalid names', async () => {
    client.get.mockResolvedValue(self(systemKey));
    client.patch.mockRejectedValue({ status: 409, code: 'USER_USERNAME_ALREADY_EXISTS' });
    const { onClose } = renderDialog();
    await openEditor();
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

describe('ProfileDialog (Manager/Cashier)', () => {
  it('keeps identity attributes read-only while retaining verification resend', async () => {
    client.get.mockResolvedValue({ ...self(null), emailVerifiedAt: null });
    renderDialog();

    await waitFor(() => expect(document.body.textContent).toContain('siti@example.com'));
    expect(
      [...document.body.querySelectorAll('button')].some((node) =>
        /Ubah profil/.test(node.textContent ?? ''),
      ),
    ).toBe(false);
    expect(field(/Nama tampilan/)).toBeNull();
    expect(
      [...document.body.querySelectorAll('button')].some((node) =>
        /Kirim tautan verifikasi/.test(node.textContent ?? ''),
      ),
    ).toBe(true);
  });
});
