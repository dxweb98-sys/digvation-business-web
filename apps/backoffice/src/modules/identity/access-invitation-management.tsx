import {
  DBadge,
  DButton,
  DCheckbox,
  DDataTable,
  DDialog,
  DInput,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { Ban, MessageCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import {
  isE164,
  normalizeIndonesianPhone,
  whatsappChatUrl,
} from '../../auth/public-auth-flow';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type {
  AccessControlApi,
  AccessRole,
  InvitationDeliveryStatus,
  UserInvitation,
} from './access-control-api';
import {
  canResendInvitation,
  canRevokeInvitation,
  invitationDeliveryLabel,
  invitationLifecycleLabel,
  invitationLifecycleStatus,
} from './invitation-presentation';

export function InvitationsTable({
  invitations,
  loading,
  canManage,
  api,
  onChanged,
  onRevoke,
}: {
  invitations: UserInvitation[];
  loading: boolean;
  canManage: boolean;
  api: AccessControlApi;
  onChanged: () => void;
  onRevoke: (invitation: UserInvitation) => void;
}) {
  const { formatDate } = useBackofficeLocalization();
  const { showToast } = useToast();
  const columns: TableColumn<UserInvitation>[] = [
    {
      key: 'displayName',
      label: 'Nama',
      render: (invitation) => <p className="font-medium">{invitation.displayName}</p>,
    },
    {
      key: 'phoneE164',
      label: 'Nomor WhatsApp',
      render: (invitation) => (
        <span className="whitespace-nowrap text-sm">{invitation.phoneE164}</span>
      ),
    },
    {
      key: 'username',
      label: 'Username',
      render: (invitation) => invitation.username ?? '-',
    },
    {
      key: 'roles',
      label: 'Peran',
      render: (invitation) => invitation.roles.map((role) => role.name).join(', ') || '-',
    },
    {
      key: 'status',
      label: 'Status undangan',
      render: (invitation) => {
        const status = invitationLifecycleStatus(invitation);
        return (
          <DBadge
            variant={status === 'ACTIVE' ? 'success' : status === 'PENDING' ? 'warning' : 'secondary'}
          >
            {invitationLifecycleLabel(status)}
          </DBadge>
        );
      },
    },
    {
      key: 'deliveryStatus',
      label: 'Status WhatsApp',
      render: (invitation) => (
        <DBadge variant={deliveryBadgeVariant(invitation.deliveryStatus)}>
          {invitationDeliveryLabel(invitation.deliveryStatus)}
        </DBadge>
      ),
    },
    {
      key: 'expiresAt',
      label: 'Berlaku sampai',
      render: (invitation) =>
        formatDate(new Date(invitation.expiresAt), {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
    {
      key: 'lastDeliveryAt',
      label: 'Terakhir dikirim',
      render: (invitation) =>
        invitation.lastDeliveryAt
          ? formatDate(new Date(invitation.lastDeliveryAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : '-',
    },
  ];

  const resend = async (invitation: UserInvitation) => {
    try {
      await api.resendInvitation(invitation.id);
      onChanged();
      showToast({ variant: 'success', title: 'Undangan dikirim ulang.' });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Undangan belum dapat dikirim ulang.').safeMessage,
        });
      }
    }
  };

  const openChat = (invitation: UserInvitation) => {
    const url = whatsappChatUrl(invitation.phoneE164);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="min-w-[980px]">
        <DDataTable
          columns={columns}
          data={invitations}
          loading={loading}
          rowKey="id"
          emptyMessage="Belum ada undangan pengguna."
          actions={[
            {
              label: 'Kirim ulang',
              icon: <RefreshCw className="size-4" />,
              onClick: (invitation) => void resend(invitation),
              show: (invitation) => canResendInvitation(invitation, canManage),
            },
            {
              label: 'Batalkan',
              icon: <Ban className="size-4" />,
              variant: 'danger',
              onClick: onRevoke,
              show: (invitation) => canRevokeInvitation(invitation, canManage),
            },
            {
              label: 'Buka chat WhatsApp',
              icon: <MessageCircle className="size-4" />,
              onClick: openChat,
              show: (invitation) => Boolean(whatsappChatUrl(invitation.phoneE164)),
            },
          ]}
        />
      </div>
    </div>
  );
}

export function InvitationDialog({
  roles,
  api,
  onClose,
  onChanged,
}: {
  roles: AccessRole[];
  api: AccessControlApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const normalizedPhone = normalizeIndonesianPhone(phone);
  const valid =
    isE164(normalizedPhone) && Boolean(displayName.trim()) && roleIds.length > 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.createInvitation({
        phoneE164: normalizedPhone,
        ...(username.trim() ? { username: username.trim() } : {}),
        displayName: displayName.trim(),
        roleIds,
      });
      onChanged();
      onClose();
      showToast({ variant: 'success', title: 'Undangan pengguna dibuat.' });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Undangan belum dapat dibuat.').safeMessage,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={onClose}
      title="Undang pengguna"
      description="Pengguna akan menerima tautan WhatsApp untuk membuat kata sandi dan mengaktifkan akun."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </DButton>
          <DButton onClick={() => void save()} disabled={!valid || saving} loading={saving}>
            Kirim undangan
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DInput
          label="Nama"
          value={displayName}
          onChange={setDisplayName}
          placeholder="Contoh: Siti Rahma"
          disabled={saving}
        />
        <DInput
          label="Nomor WhatsApp"
          value={phone}
          onChange={setPhone}
          placeholder="0812 3456 7890"
          disabled={saving}
        />
        <DInput
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="Opsional"
          disabled={saving}
        />
      </div>

      {phone.trim() && !isE164(normalizedPhone) ? (
        <p className="mt-2 text-xs text-[var(--color-danger)]">
          Masukkan nomor telepon yang valid. Nomor akan disimpan dalam format internasional, misalnya +6281234567890.
        </p>
      ) : null}
      {phone.trim() && isE164(normalizedPhone) ? (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Nomor tersimpan sebagai {normalizedPhone}. Format nomor yang valid tidak berarti nomor tersebut sudah terverifikasi dapat menerima WhatsApp.
        </p>
      ) : null}

      <section className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="text-sm font-semibold">Peran</p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Pilih setidaknya satu peran aktif untuk pengguna ini.
        </p>
        <div className="mt-3 max-h-64 divide-y divide-[var(--color-border)] overflow-y-auto border-y border-[var(--color-border)]">
          {roles.map((role) => (
            <label key={role.id} className="flex min-h-11 items-center gap-3 py-2.5 text-sm">
              <DCheckbox
                checked={roleIds.includes(role.id)}
                disabled={saving}
                onChange={() =>
                  setRoleIds((values) =>
                    values.includes(role.id)
                      ? values.filter((item) => item !== role.id)
                      : [...values, role.id],
                  )
                }
              />
              <span className="min-w-0 break-words">{role.name}</span>
            </label>
          ))}
        </div>
      </section>
    </DDialog>
  );
}

function deliveryBadgeVariant(status: InvitationDeliveryStatus) {
  if (status === 'FAILED') return 'danger' as const;
  if (status === 'DELIVERED' || status === 'READ') return 'success' as const;
  if (status === 'SENT') return 'secondary' as const;
  return 'warning' as const;
}
