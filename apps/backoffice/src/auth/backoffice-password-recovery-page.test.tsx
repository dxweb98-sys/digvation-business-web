import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import { BackofficePasswordRecoveryPage } from './backoffice-password-recovery-page';
import {
  PasswordRecoveryProvider,
  PasswordRecoveryUnavailableError,
  type PasswordRecoveryPort,
} from './password-recovery';

vi.mock('./backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'unauthenticated', session: null }),
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

function renderRecovery(port: PasswordRecoveryPort, config: DeploymentBootstrapConfig = bootstrap) {
  return render(
    <DeploymentBootstrapProvider config={config}>
      <BackofficeLocalizationProvider>
        <PasswordRecoveryProvider port={port}>
          <MemoryRouter initialEntries={['/forgot-password']}>
            <BackofficePasswordRecoveryPage />
          </MemoryRouter>
        </PasswordRecoveryProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

async function submitIdentifier(container: HTMLElement, identifier: string) {
  const view = within(container);
  fireEvent.change(container.querySelector('#backoffice-recovery-identifier')!, {
    target: { value: identifier },
  });
  await act(async () => {
    fireEvent.click(view.getByRole('button', { name: 'Kirim tautan' }));
  });
}

describe('BackofficePasswordRecoveryPage', () => {
  it('asks only for the registered identifier', () => {
    const { container } = renderRecovery({ request: vi.fn() });

    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(within(container).queryByText(/ruang kerja|workspace/i)).toBeNull();
  });

  it('shows the sent state only after the recovery port resolves', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    const { container } = renderRecovery({ request });

    await submitIdentifier(container, ' owner ');

    expect(request).toHaveBeenCalledWith({ identifier: 'owner' });
    expect(within(container).queryByText('Periksa WhatsApp Anda')).not.toBeNull();
  });

  it('reports an unavailable recovery engine without claiming success', async () => {
    const { container } = renderRecovery({
      request: () => Promise.reject(new PasswordRecoveryUnavailableError()),
    });

    await submitIdentifier(container, 'owner');

    expect(within(container).getByRole('alert').textContent).toContain(
      'Pemulihan kata sandi belum dapat digunakan',
    );
    expect(within(container).queryByText('Periksa WhatsApp Anda')).toBeNull();
  });

  it('keeps the request action pending while the recovery port is in flight', async () => {
    const { container } = renderRecovery({ request: () => new Promise<void>(() => undefined) });

    await submitIdentifier(container, 'owner');

    expect(within(container).queryByText('Mengirim…')).not.toBeNull();
  });

  it('blocks recovery when the deployment has no trusted workspace', () => {
    const request = vi.fn();
    const { container } = renderRecovery(
      { request },
      { ...bootstrap, workspaceResolution: { mode: 'LOGIN' } },
    );

    expect(within(container).queryByText(/belum terhubung ke bisnis/)).not.toBeNull();
    expect(
      (within(container).getByRole('button', { name: 'Kirim tautan' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
