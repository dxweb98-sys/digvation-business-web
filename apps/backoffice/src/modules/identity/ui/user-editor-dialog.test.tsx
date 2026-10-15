import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DToastProvider } from '@digvation/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { AccessUser } from '../access-control-api';
import { UserEditorDialog } from './user-editor-dialog';

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

const user = {
  id: 'u-1',
  displayName: 'Siti Rahma',
  username: 'siti.rahma',
  status: 'ACTIVE',
  version: 4,
  roles: [{ id: 'r-1', code: 'STAFF', name: 'Staff', systemKey: null }],
} as unknown as AccessUser;

function renderEditor(api: Record<string, unknown>, canManageRoles = false) {
  const onChanged = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeploymentBootstrapProvider config={bootstrap}>
        <DToastProvider>
          <BackofficeLocalizationProvider>
            <UserEditorDialog
              user={user}
              roles={[]}
              api={api as never}
              operationalAccess={{} as never}
              canManageRoles={canManageRoles}
              canUpdateProfile
              canViewLocations={false}
              canManageLocations={false}
              onClose={onClose}
              onChanged={onChanged}
            />
          </BackofficeLocalizationProvider>
        </DToastProvider>
      </DeploymentBootstrapProvider>
    </QueryClientProvider>,
  );
  return { onChanged, onClose };
}

const field = (label: RegExp) => {
  const match = [...document.body.querySelectorAll('label')].find((node) =>
    label.test(node.textContent ?? ''),
  );
  return document.getElementById(match?.getAttribute('for') ?? '') as HTMLInputElement;
};
const press = async (name: string) => {
  const target = [...document.body.querySelectorAll('button')].find(
    (node) => node.textContent === name,
  )!;
  await act(async () => {
    fireEvent.click(target);
  });
};

afterEach(cleanup);

describe('UserEditorDialog username', () => {
  it('shows the current username and sends only the changed, trimmed username', async () => {
    const updateUser = vi.fn().mockResolvedValue(user);
    const { onChanged } = renderEditor({ updateUser });
    expect(field(/Username masuk/).value).toBe('siti.rahma');
    fireEvent.change(field(/Username masuk/), { target: { value: ' Siti.R ' } });
    await press('Simpan perubahan');
    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    expect(updateUser).toHaveBeenCalledWith(user, { username: 'Siti.R' });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('does not send an unchanged username and validates a changed one before saving', async () => {
    const updateUser = vi.fn().mockResolvedValue(user);
    renderEditor({ updateUser });
    fireEvent.change(field(/Username masuk/), { target: { value: 'x' } });
    await press('Simpan perubahan');
    expect(updateUser).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Gunakan 3 sampai 64 huruf');
  });

  it.each([
    ['USER_USERNAME_ALREADY_EXISTS', 'Username ini sudah dipakai pengguna lain.'],
    ['INVITATION_USERNAME_PENDING', 'Username ini masih memiliki undangan yang menunggu.'],
  ])('shows %s under the username field and clears it on edit', async (code, message) => {
    const updateUser = vi.fn().mockRejectedValue({ status: 409, code });
    const { onClose } = renderEditor({ updateUser });
    fireEvent.change(field(/Username masuk/), { target: { value: 'taken.name' } });
    await press('Simpan perubahan');
    await waitFor(() => expect(document.body.textContent).toContain(message));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(field(/Username masuk/), { target: { value: 'free.name' } });
    await waitFor(() => expect(document.body.textContent).not.toContain(message));
  });
});
