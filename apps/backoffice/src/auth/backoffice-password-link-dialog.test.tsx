import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import { BackofficePasswordLinkDialog } from './backoffice-password-link-dialog';

const getAccessToken = vi.fn().mockResolvedValue('access-token');
const logout = vi.fn().mockResolvedValue(undefined);

vi.mock('./backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ getAccessToken, logout }),
}));

const bootstrap = {
  apiBaseUrl: 'http://runtime.test',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

function renderDialog(onClose = vi.fn()) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <BackofficePasswordLinkDialog open onClose={onClose} />
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

const button = (name: string) =>
  [...document.body.querySelectorAll('button')].find((node) => node.textContent === name)!;

const inputs = () => [...document.body.querySelectorAll('input')];
const type = (index: number, value: string) =>
  act(async () => {
    fireEvent.change(inputs()[index]!, { target: { value } });
  });
const press = (name: string) =>
  act(async () => {
    fireEvent.click(button(name));
  });
const submitForm = () =>
  act(async () => {
    fireEvent.submit(document.body.querySelector('form')!);
  });
const fillForm = async (current: string, next: string, confirm = next) => {
  await type(0, current);
  await type(1, next);
  await type(2, confirm);
};

beforeEach(() => {
  getAccessToken.mockClear();
  logout.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BackofficePasswordLinkDialog', () => {
  it('opens on the current-password form; the reset link is a separate, discoverable option', () => {
    renderDialog();
    expect(inputs()).toHaveLength(3);
    expect(document.body.textContent).toContain('Kata sandi saat ini');
    expect(document.body.textContent).toContain('Lupa kata sandi saat ini?');
    expect(button('Ubah kata sandi')).toBeTruthy();
  });

  it('validates locally and never calls the Runtime for a mismatch or an unchanged password', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    await fillForm('Correct-Horse-9', 'Another-Passphrase-1', 'Different-Passphrase-2');
    await submitForm();
    expect(document.body.textContent).toContain('Konfirmasi kata sandi belum sama');
    await fillForm('Correct-Horse-9', 'Correct-Horse-9');
    await submitForm();
    expect(document.body.textContent).toContain('harus berbeda');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an incorrect current password inline without signing the user out', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { code: 'INVALID_CREDENTIALS' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    await fillForm('Wrong-Password-1', 'Another-Passphrase-1');
    await submitForm();
    await waitFor(() =>
      expect(document.body.textContent).toContain('Kata sandi saat ini tidak benar.'),
    );
    expect(logout).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('sesi Anda sudah berakhir');
    expect(inputs()).toHaveLength(3);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://runtime.test/api/v1/auth/change-password');
    expect(JSON.parse(String(init.body))).toEqual({
      currentPassword: 'Wrong-Password-1',
      newPassword: 'Another-Passphrase-1',
    });
  });

  it('confirms the change, states that sessions ended and signs out only when the user continues', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const onClose = vi.fn();
    renderDialog(onClose);
    await fillForm('Correct-Horse-9', 'Another-Passphrase-1');
    await submitForm();
    await waitFor(() => expect(document.body.textContent).toContain('Kata sandi berhasil diubah'));
    expect(inputs()).toHaveLength(0);
    expect(logout).not.toHaveBeenCalled();
    await press('Masuk lagi');
    expect(logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the reset link as its own flow and does not claim delivery', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    await press('Lupa kata sandi saat ini? Kirim tautan lewat WhatsApp');
    expect(inputs()).toHaveLength(0);
    await press('Kirim tautan');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://runtime.test/api/v1/auth/password-change/request');
    expect(init.body).toBe('{}');
    await waitFor(() => expect(document.body.textContent).toContain('diserahkan ke penyedia'));
    expect(document.body.textContent).not.toMatch(/terkirim|sudah dikirim/i);
  });

  it('shows a cooldown as a warning without claiming that a link was sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: { code: 'PASSWORD_RESET_COOLDOWN' } }),
      }),
    );
    renderDialog();
    await press('Lupa kata sandi saat ini? Kirim tautan lewat WhatsApp');
    await press('Kirim tautan');
    await waitFor(() => expect(document.body.textContent).toContain('Tautan baru saja dikirim'));
    expect(document.body.textContent).not.toContain('diserahkan ke penyedia');
    expect(button('Kirim tautan')).toBeTruthy();
  });

  it('reports a failed link request and allows another attempt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    renderDialog();
    await press('Lupa kata sandi saat ini? Kirim tautan lewat WhatsApp');
    await press('Kirim tautan');
    await waitFor(() => expect(document.body.textContent).toContain('belum berhasil dikirim'));
    expect(button('Kirim tautan')).toBeTruthy();
  });
});
