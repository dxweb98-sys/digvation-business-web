import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import {
  AccountActivationError,
  AccountActivationProvider,
  type AccountActivationPort,
} from './account-activation';
import { BackofficeAccountActivationPage } from './backoffice-account-activation-page';

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

const INVITATION = '3f1c9e0e-6a54-4a52-8d57-0d1a5a0f6a11';
const TOKEN = 'A'.repeat(43);
const LINK = `/activate?workspace=onboarding-test&invitation=${INVITATION}#token=${TOKEN}`;
const PASSWORD = 'Correct-Horse-9';

function LoginProbe() {
  return <p>login-page</p>;
}

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
  );
}

function renderPage(port: AccountActivationPort, entry = LINK) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <AccountActivationProvider port={port}>
          <MemoryRouter initialEntries={[entry]}>
            <LocationProbe />
            <Routes>
              <Route path="/activate" element={<BackofficeAccountActivationPage />} />
              <Route path="/login" element={<LoginProbe />} />
            </Routes>
          </MemoryRouter>
        </AccountActivationProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

function port(overrides: Partial<AccountActivationPort> = {}): AccountActivationPort {
  return {
    inspect: vi.fn().mockResolvedValue({ status: 'VALID', businessName: 'Salon Uji' }),
    activate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function fill(container: HTMLElement, password: string, confirmation: string) {
  fireEvent.change(container.querySelector('#backoffice-activation-password')!, {
    target: { value: password },
  });
  fireEvent.change(container.querySelector('#backoffice-activation-confirmation')!, {
    target: { value: confirmation },
  });
}

const submitButton = (container: HTMLElement) =>
  within(container).getByRole('button', { name: 'Aktifkan akun' }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => meta.remove());
  window.history.replaceState(null, '', '/');
});

describe('BackofficeAccountActivationPage', () => {
  it('checks the link and shows business context with new and confirm password', async () => {
    const activation = port();
    const { container } = renderPage(activation);

    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());
    expect(activation.inspect).toHaveBeenCalledWith({
      workspace: 'onboarding-test',
      invitationId: INVITATION,
      token: TOKEN,
    });
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(2);
    expect(submitButton(container).disabled).toBe(true);
  });

  it('rejects mismatched or short passwords before calling the Runtime', async () => {
    const activation = port();
    const { container } = renderPage(activation);
    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());

    await fill(container, PASSWORD, `${PASSWORD}x`);
    expect(submitButton(container).disabled).toBe(true);
    expect(within(container).queryByText('Konfirmasi kata sandi belum sama.')).not.toBeNull();

    await fill(container, 'short', 'short');
    fireEvent.blur(container.querySelector('#backoffice-activation-password')!);
    expect(within(container).queryByText(/10 sampai 128/)).not.toBeNull();
    expect(activation.activate).not.toHaveBeenCalled();
  });

  it('activates once, never puts the password in the URL, and offers sign-in', async () => {
    const activation = port();
    const { container, getByTestId } = renderPage(activation);
    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());

    await fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submitButton(container));
    });

    expect(activation.activate).toHaveBeenCalledTimes(1);
    expect(activation.activate).toHaveBeenCalledWith({
      workspace: 'onboarding-test',
      invitationId: INVITATION,
      token: TOKEN,
      password: PASSWORD,
    });
    expect(within(container).queryByText('Akun Anda sudah aktif')).not.toBeNull();
    expect(getByTestId('location').textContent).not.toContain(PASSWORD);

    await act(async () => {
      fireEvent.click(within(container).getByRole('button', { name: 'Ke halaman masuk' }));
    });
    expect(within(container).queryByText('login-page')).not.toBeNull();
  });

  it.each([
    ['EXPIRED', 'Tautan sudah kedaluwarsa'],
    ['USED', 'Tautan sudah digunakan'],
    ['REVOKED', 'Tautan dibatalkan'],
    ['INVALID', 'Tautan tidak valid'],
  ] as const)('shows the %s state without a form or identity', async (status, title) => {
    const { container } = renderPage(port({ inspect: vi.fn().mockResolvedValue({ status }) }));

    await waitFor(() => expect(within(container).queryByText(title)).not.toBeNull());
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(within(container).queryByText('Salon Uji')).toBeNull();
  });

  it('asks to reopen the invitation link when the token is missing and never calls the Runtime', async () => {
    const activation = port();
    const { container } = renderPage(
      activation,
      `/activate?workspace=onboarding-test&invitation=${INVITATION}`,
    );

    await waitFor(() =>
      expect(within(container).queryByText('Buka kembali tautan undangan')).not.toBeNull(),
    );
    expect(within(container).queryByText('Akun Anda sudah aktif')).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(activation.inspect).not.toHaveBeenCalled();
  });

  it('maps a rejected activation to the matching state and keeps no form', async () => {
    const activation = port({
      activate: vi.fn().mockRejectedValue(new AccountActivationError('used')),
    });
    const { container } = renderPage(activation);
    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());

    await fill(container, PASSWORD, PASSWORD);
    await act(async () => {
      fireEvent.click(submitButton(container));
    });

    expect(within(container).queryByText('Tautan sudah digunakan')).not.toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('reports a network failure and can retry the check', async () => {
    const inspect = vi
      .fn()
      .mockRejectedValueOnce(new AccountActivationError('network'))
      .mockResolvedValue({ status: 'VALID', businessName: 'Salon Uji' });
    const { container } = renderPage(port({ inspect }));

    await waitFor(() =>
      expect(within(container).queryByText('Tidak dapat terhubung')).not.toBeNull(),
    );
    await act(async () => {
      fireEvent.click(within(container).getByRole('button', { name: 'Coba lagi' }));
    });

    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());
    expect(inspect).toHaveBeenCalledTimes(2);
  });

  it('picks up the invitation link when it is re-opened in the same tab', async () => {
    const activation = port();
    window.history.replaceState(
      null,
      '',
      `/activate?workspace=onboarding-test&invitation=${INVITATION}`,
    );
    const { container } = renderPage(
      activation,
      `/activate?workspace=onboarding-test&invitation=${INVITATION}`,
    );
    await waitFor(() =>
      expect(within(container).queryByText('Buka kembali tautan undangan')).not.toBeNull(),
    );

    await act(async () => {
      window.location.hash = `#token=${TOKEN}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());
    expect(activation.inspect).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe('');
  });

  it('removes the token fragment from the address bar after capturing it', async () => {
    window.history.replaceState(null, '', LINK);
    const { container } = renderPage(port(), LINK);
    await waitFor(() => expect(within(container).queryByText('Salon Uji')).not.toBeNull());

    expect(window.location.hash).toBe('');
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
      'no-referrer',
    );
  });
});
