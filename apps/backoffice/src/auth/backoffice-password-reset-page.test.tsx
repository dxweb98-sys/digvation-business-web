import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import { BackofficePasswordResetPage } from './backoffice-password-reset-page';
import {
  PasswordRecoveryProvider,
  PasswordResetError,
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

const CHALLENGE = '3f1c9e0e-6a54-4a52-8d57-0d1a5a0f6a11';
const TOKEN = 'B'.repeat(43);
const LINK = `/reset-password?workspace=onboarding-test&challenge=${CHALLENGE}#token=${TOKEN}`;
const PASSWORD = 'Correct-Horse-9';

function renderPage(port: PasswordRecoveryPort, entry = LINK) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <PasswordRecoveryProvider port={port}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/reset-password" element={<BackofficePasswordResetPage />} />
              <Route path="/login" element={<p>login-page</p>} />
              <Route path="/forgot-password" element={<p>forgot-page</p>} />
            </Routes>
          </MemoryRouter>
        </PasswordRecoveryProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

function port(overrides: Partial<PasswordRecoveryPort> = {}): PasswordRecoveryPort {
  return {
    request: vi.fn().mockResolvedValue(undefined),
    confirm: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function fill(container: HTMLElement, password: string, confirmation: string) {
  fireEvent.change(container.querySelector('#backoffice-reset-password')!, {
    target: { value: password },
  });
  fireEvent.change(container.querySelector('#backoffice-reset-confirmation')!, {
    target: { value: confirmation },
  });
}

const submit = (container: HTMLElement) =>
  within(container).getByRole('button', { name: 'Simpan kata sandi' }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => meta.remove());
  window.history.replaceState(null, '', '/');
});

describe('BackofficePasswordResetPage', () => {
  it('asks for a new password twice and keeps submit disabled until they match', () => {
    const { container } = renderPage(port());
    expect(within(container).getByRole('heading', { name: 'Buat kata sandi baru' })).toBeTruthy();
    expect(submit(container).disabled).toBe(true);
    fill(container, PASSWORD, 'Different-Pass-9');
    expect(submit(container).disabled).toBe(true);
    expect(within(container).getByText('Konfirmasi kata sandi belum sama.')).toBeTruthy();
    fill(container, 'short', 'short');
    expect(submit(container).disabled).toBe(true);
    fill(container, PASSWORD, PASSWORD);
    expect(submit(container).disabled).toBe(false);
  });

  it('sends the workspace, challenge and token once, then points to sign-in', async () => {
    const recovery = port();
    const { container } = renderPage(recovery);
    fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submit(container));
    });
    await waitFor(() => expect(within(container).getByText('Kata sandi diperbarui')).toBeTruthy());
    expect(recovery.confirm).toHaveBeenCalledTimes(1);
    expect(recovery.confirm).toHaveBeenCalledWith({
      workspace: 'onboarding-test',
      challengeId: CHALLENGE,
      token: TOKEN,
      newPassword: PASSWORD,
    });
    fireEvent.click(within(container).getByRole('button', { name: 'Ke halaman masuk' }));
    await waitFor(() => expect(within(container).getByText('login-page')).toBeTruthy());
  });

  it('removes the token from the address bar and refuses to render a link without one', () => {
    window.history.replaceState(null, '', LINK);
    renderPage(port());
    expect(window.location.hash).toBe('');
    cleanup();
    const { container } = renderPage(port(), '/reset-password?workspace=onboarding-test');
    expect(within(container).getByText('Tautan tidak valid atau sudah digunakan')).toBeTruthy();
  });

  it.each([
    ['invalid', 'Tautan tidak valid atau sudah digunakan'],
    ['expired', 'Tautan sudah kedaluwarsa'],
  ] as const)('shows a recoverable %s state without exposing the token', async (reason, title) => {
    const { container } = renderPage(
      port({ confirm: vi.fn().mockRejectedValue(new PasswordResetError(reason)) }),
    );
    fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submit(container));
    });
    await waitFor(() => expect(within(container).getByText(title)).toBeTruthy());
    expect(container.textContent).not.toContain(TOKEN);
    fireEvent.click(within(container).getByRole('button', { name: 'Minta tautan baru' }));
    await waitFor(() => expect(within(container).getByText('forgot-page')).toBeTruthy());
  });

  it('lets the user retry after a network failure with the same in-memory link', async () => {
    const confirm = vi
      .fn()
      .mockRejectedValueOnce(new PasswordResetError('network'))
      .mockResolvedValueOnce(undefined);
    const { container } = renderPage(port({ confirm }));
    fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submit(container));
    });
    await waitFor(() => expect(within(container).getByText('Tidak dapat terhubung')).toBeTruthy());
    fireEvent.click(within(container).getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(submit(container)).toBeTruthy());
    fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submit(container));
    });
    await waitFor(() => expect(within(container).getByText('Kata sandi diperbarui')).toBeTruthy());
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
