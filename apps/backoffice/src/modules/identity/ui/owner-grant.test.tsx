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

const role = (id: string, name: string, systemKey: 'OWNER' | null): AccessRole => ({
  id,
  code: name.toUpperCase(),
  name,
  status: 'ACTIVE',
  systemKey,
  version: 1,
  permissions: ['users:read'],
});
const roles = [role('r-owner', 'Owner', 'OWNER'), role('r-staff', 'Staff', null)];

const text = () => document.body.textContent ?? '';
const roleBox = (name: string) =>
  [...document.body.querySelectorAll('label')]
    .find((node) => node.textContent?.includes(name))
    ?.querySelector('input[type="checkbox"]') as HTMLInputElement;
const field = (label: RegExp) => {
  const match = [...document.body.querySelectorAll('label')].find((node) =>
    label.test(node.textContent ?? ''),
  );
  return document.getElementById(match?.getAttribute('for') ?? '') as HTMLInputElement;
};
const send = async () => {
  const target = [...document.body.querySelectorAll('button')].find(
    (node) => node.textContent === 'Kirim undangan',
  )!;
  await act(async () => {
    fireEvent.click(target);
  });
};

afterEach(cleanup);

function renderDialog(createInvitation: ReturnType<typeof vi.fn>) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <DToastProvider>
        <BackofficeLocalizationProvider>
          <InvitationDialog
            roles={roles}
            api={{ createInvitation } as never}
            onClose={vi.fn()}
            onChanged={vi.fn()}
          />
        </BackofficeLocalizationProvider>
      </DToastProvider>
    </DeploymentBootstrapProvider>,
  );
}

describe('InvitationDialog Owner assignment', () => {
  it('preselects no role and sends exactly the roles that are shown selected', async () => {
    const createInvitation = vi.fn().mockResolvedValue({});
    renderDialog(createInvitation);
    expect(roleBox('Owner').checked).toBe(false);
    expect(roleBox('Staff').checked).toBe(false);
    fireEvent.change(field(/Nama tampilan|Display name/), { target: { value: 'Siti Rahma' } });
    fireEvent.change(field(/Nomor telepon|Phone number/), { target: { value: '081234567890' } });
    fireEvent.change(field(/^Email$/), { target: { value: 'siti@business.com' } });
    fireEvent.click(roleBox('Staff'));
    expect(roleBox('Staff').checked).toBe(true);
    await send();
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    expect(createInvitation.mock.calls[0]![0].roleIds).toEqual(['r-staff']);
  });

  it('requires an explicit Owner confirmation and explains that combining roles does not reduce it', async () => {
    const createInvitation = vi.fn().mockResolvedValue({});
    renderDialog(createInvitation);
    fireEvent.change(field(/Nama tampilan|Display name/), { target: { value: 'Siti Rahma' } });
    fireEvent.change(field(/Nomor telepon|Phone number/), { target: { value: '081234567890' } });
    fireEvent.change(field(/^Email$/), { target: { value: 'siti@business.com' } });
    fireEvent.click(roleBox('Staff'));
    fireEvent.click(roleBox('Owner'));
    expect(text()).toContain('tidak menguranginya');
    await send();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(text()).toContain('Konfirmasi peran Owner');
    fireEvent.click(roleBox('Saya konfirmasi'));
    await send();
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    expect([...createInvitation.mock.calls[0]![0].roleIds].sort()).toEqual(['r-owner', 'r-staff']);
  });
});
