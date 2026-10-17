import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { AccessRole } from '../access-control-api';
import { InvitationDialog } from './invitation-dialog';

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

const roles: AccessRole[] = [
  {
    id: '3f1c9e0e-6a54-4a52-8d57-0d1a5a0f6a11',
    code: 'MANAGER',
    name: 'Manager',
    status: 'ACTIVE',
    systemKey: null,
    version: 1,
    permissions: ['users:read', 'roles:read'],
  },
];

function renderDialog(createInvitation: ReturnType<typeof vi.fn>, onChanged = vi.fn()) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <BackofficeLocalizationProvider>
          <InvitationDialog
            roles={roles}
            api={{ createInvitation } as never}
            onClose={vi.fn()}
            onChanged={onChanged}
          />
        </BackofficeLocalizationProvider>
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
  return onChanged;
}

const field = (label: RegExp | string) => {
  const labels = [...document.body.querySelectorAll('label')];
  const match = labels.find((node) =>
    typeof label === 'string' ? node.textContent === label : label.test(node.textContent ?? ''),
  );
  const id = match?.getAttribute('for');
  return (id ? document.getElementById(id) : null) as HTMLInputElement;
};
const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const click = async (name: string) => {
  const button = [...document.body.querySelectorAll('button')].find(
    (node) => node.textContent === name,
  )!;
  await act(async () => {
    fireEvent.click(button);
  });
};

afterEach(cleanup);

describe('InvitationDialog', () => {
  it('shows national phone format and sends canonical E.164', async () => {
    const createInvitation = vi.fn().mockResolvedValue({});
    const onChanged = renderDialog(createInvitation);
    type(field('Nama tampilan'), 'Siti Rahma');
    type(field('Nomor telepon'), '+62 812-3456-7890');
    expect(field('Nomor telepon').value).toBe('081234567890');
    type(field(/Username/), 'siti.rahma');
    fireEvent.click(document.body.querySelector('input[type="checkbox"]')!);
    await click('Kirim undangan');
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    expect(createInvitation).toHaveBeenCalledWith({
      phoneE164: '+6281234567890',
      username: 'siti.rahma',
      displayName: 'Siti Rahma',
      roleIds: [roles[0]!.id],
    });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('keeps invalid fields next to their field after the first attempt', async () => {
    const createInvitation = vi.fn();
    renderDialog(createInvitation);
    await click('Kirim undangan');
    expect(createInvitation).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Masukkan nama tampilan.');
    expect(document.body.textContent).toContain('Masukkan nomor telepon.');
    expect(document.body.textContent).toContain('Pilih minimal satu peran.');
    expect(document.body.textContent).not.toContain('E.164');
  });

  it.each([
    ['USER_PHONE_ALREADY_EXISTS', 'Nomor telepon ini sudah dipakai pengguna lain.'],
    [
      'INVITATION_PHONE_PENDING',
      'Nomor telepon ini masih memiliki undangan yang menunggu. Kirim ulang atau batalkan undangan itu terlebih dahulu.',
    ],
    ['USER_USERNAME_ALREADY_EXISTS', 'Username ini sudah dipakai pengguna lain.'],
  ])('shows the %s conflict under its field and clears it on edit', async (code, message) => {
    const createInvitation = vi.fn().mockRejectedValue({
      status: 409,
      code,
    });
    renderDialog(createInvitation);
    type(field('Nama tampilan'), 'Siti Rahma');
    type(field('Nomor telepon'), '081234567890');
    if (code.includes('USERNAME')) type(field(/Username/), 'siti.rahma');
    fireEvent.click(document.body.querySelector('input[type="checkbox"]')!);
    await click('Kirim undangan');
    await waitFor(() => expect(document.body.textContent).toContain(message));
    type(field(code.includes('USERNAME') ? /Username/ : 'Nomor telepon'), '081299999999');
    await waitFor(() => expect(document.body.textContent).not.toContain(message));
  });
});
