import type { ApiClient } from '@digvation/business-api';
import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CustomerMemberApi } from '../customer-member-api';

import { CustomerMemberDialog } from './customer-member-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

afterEach(cleanup);

const enrolledMember = {
  id: 'membership-1',
  customerId: 'customer-1',
  memberNumber: 'MEMBER-001',
  status: 'ACTIVE',
  customer: { id: 'customer-1', name: 'Budi', phoneE164: '+6281234567890', status: 'ACTIVE' },
};

function renderDialog(overrides: { onChoose?: () => void } = {}) {
  const post = vi.fn().mockResolvedValue(enrolledMember);
  const api = new CustomerMemberApi({ post, get: vi.fn() } as unknown as ApiClient);
  const onChoose = overrides.onChoose ?? vi.fn();
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <QueryClientProvider client={new QueryClient()}>
        <CustomerMemberDialog
          open
          customer={null}
          isSaving={false}
          api={api}
          canReadMembers
          canEnrollMember
          canReadLoyalty
          onClose={vi.fn()}
          onChoose={onChoose}
        />
      </QueryClientProvider>
    </DeploymentBootstrapProvider>,
  );
  return { post, onChoose };
}

const openEnrollTab = () =>
  fireEvent.click(screen.getByRole('tab', { name: /Daftar Member Baru/ }));

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (input: HTMLInputElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const enrollButton = () =>
  screen.getByRole('button', { name: /Daftar & Pilih Member/ }) as HTMLButtonElement;

function fillEnrollment(nik: string) {
  type(field(/^Nama Lengkap/), 'Budi Santoso');
  type(field(/Nomor WhatsApp/), '081234567890');
  type(field(/^NIK/), nik);
}

describe('CustomerMemberDialog form input', () => {
  it('guides the regular customer fields with placeholders and keeps the labels', () => {
    renderDialog();

    expect(field(/^Nama Pelanggan/).placeholder).toBe('Contoh: Budi Santoso');
    const phone = field(/Nomor WhatsApp/);
    expect(phone.placeholder).toBe('Contoh: 081234567890');
    expect(phone.placeholder).not.toContain('+62');
  });

  it('submits the national number unchanged for a regular customer', () => {
    const { onChoose, post } = renderDialog();

    type(field(/^Nama Pelanggan/), 'Budi');
    type(field(/Nomor WhatsApp/), '0812-3456 7890');
    expect(field(/Nomor WhatsApp/).value).toBe('081234567890');
    fireEvent.click(screen.getByRole('button', { name: 'Gunakan Pelanggan' }));

    expect(onChoose).toHaveBeenCalledWith({
      type: 'NON_MEMBER',
      name: 'Budi',
      phone: '081234567890',
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('guides the enrollment fields and keeps name and phone typed on the customer tab', () => {
    renderDialog();
    type(field(/^Nama Pelanggan/), 'Budi');
    type(field(/Nomor WhatsApp/), '0812');
    openEnrollTab();

    const fullName = field(/^Nama Lengkap/);
    expect(fullName.placeholder).toBe('Nama lengkap pelanggan');
    expect(fullName.value).toBe('Budi');
    expect(field(/Nomor WhatsApp/).value).toBe('0812');
    expect(field(/Nomor WhatsApp/).placeholder).toBe('Contoh: 081234567890');
    expect(field(/^NIK/).placeholder).toBe('16 digit angka');
  });

  it('strips non-digits from member phone and NIK and caps NIK at 16 digits', () => {
    renderDialog();
    openEnrollTab();

    type(field(/Nomor WhatsApp/), '08a12-34b');
    expect(field(/Nomor WhatsApp/).value).toBe('081234');

    const nik = field(/^NIK/);
    expect(nik.maxLength).toBe(16);
    type(nik, '3174');
    expect(nik.value).toBe('3174');
    type(nik, '3174abcd123456789999');
    expect(nik.value).toBe('3174123456789999');
    expect(nik.value).toHaveLength(16);
  });

  it('keeps enrollment disabled until the NIK has exactly 16 digits', () => {
    renderDialog();
    openEnrollTab();

    fillEnrollment('317412345678999');
    expect(enrollButton().disabled).toBe(true);

    type(field(/^NIK/), '3174123456789999');
    expect(enrollButton().disabled).toBe(false);
  });

  it('enrolls with the canonical E.164 phone and clears the NIK', async () => {
    const { post, onChoose } = renderDialog();
    openEnrollTab();
    fillEnrollment('3174123456789999');

    fireEvent.click(enrollButton());

    await waitFor(() => expect(onChoose).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/api/v1/memberships', {
      name: 'Budi Santoso',
      phone: '+6281234567890',
      nik: '3174123456789999',
    });
    expect(field(/^NIK/).value).toBe('');
  });
});
