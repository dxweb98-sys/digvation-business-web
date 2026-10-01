import { useRuntime } from '@digvation/business-runtime';
import {
  DButton,
  DConfirmDialog,
  DDataTable,
  DStatusFilter,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Eye, FileSpreadsheet, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { MemberDetailDialog, memberQueryKeys } from './member-detail-dialog';
import { MemberEditor } from './member-editor';
import { MemberImportDialog } from './member-import-dialog';
import { toNationalMemberPhone } from './member-phone';
import { MembersApi, type Member, type Status } from './members-api';
import { membershipCopy } from './membership-copy';
import { MemberStatusBadge } from './membership-surfaces';

const PAGE_SIZE = 20;

/** Coordinates the Member list and its dialogs; each dialog owns its own behavior. */
export function MembersPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { formatDate } = useBackofficeLocalization();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => new MembersApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Member | null | undefined>();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Member | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  const list = useQuery({
    queryKey: [...memberQueryKeys.all, q, status, offset],
    queryFn: () =>
      api.list({ ...(q ? { q } : {}), ...(status ? { status } : {}), limit: PAGE_SIZE, offset }),
    enabled: !!session,
  });
  if (!session) return null;

  const copy = membershipCopy();
  const canEnroll = canPerformBackofficeAction(session, 'enrollMember');
  const canManage = canPerformBackofficeAction(session, 'manageMember');
  const canViewLoyalty = session.access.permissions.includes('loyalty:read');
  const refresh = () => void queryClient.invalidateQueries({ queryKey: memberQueryKeys.all });

  const confirmStatus = async () => {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true);
    try {
      await api.updateStatus(
        statusTarget,
        statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      );
      refresh();
      setStatusTarget(null);
      showToast({ variant: 'success', title: copy.statusUpdated });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({ variant: 'danger', title: normalizeBackofficeApiError(error).safeMessage });
    } finally {
      setChangingStatus(false);
    }
  };

  const columns: TableColumn<Member>[] = [
    {
      key: 'number',
      label: copy.memberNumber,
      render: (member) => <span className="font-mono text-xs">{member.memberNumber}</span>,
    },
    { key: 'customer', label: copy.customer, render: (member) => member.customer.name },
    {
      key: 'phone',
      label: copy.phone,
      render: (member) => toNationalMemberPhone(member.customer.phoneE164),
    },
    {
      key: 'status',
      label: copy.status,
      render: (member) => <MemberStatusBadge status={member.status} />,
    },
  ];

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy.pageEyebrow}
        title={copy.pageTitle}
        description={copy.pageDescription}
      />
      <div className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          searchable
          searchPlaceholder={copy.searchPlaceholder}
          searchValue={q}
          onSearchChange={(value) => {
            setQ(value);
            setOffset(0);
          }}
          filters={
            <DStatusFilter
              label={copy.status}
              value={status}
              onChange={(value) => {
                setStatus(value as '' | Status);
                setOffset(0);
              }}
              allLabel={copy.all}
              options={[
                { label: copy.active, value: 'ACTIVE' },
                { label: copy.inactive, value: 'INACTIVE' },
              ]}
            />
          }
          headerActions={
            canEnroll ? (
              <div className="flex flex-wrap gap-2">
                <DButton
                  variant="secondary"
                  leftIcon={<FileSpreadsheet className="size-4" />}
                  onClick={() => setImporting(true)}
                >
                  {copy.import}
                </DButton>
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
                  {copy.enroll}
                </DButton>
              </div>
            ) : null
          }
          emptyMessage={copy.empty}
          pagination={{
            page: Math.floor(offset / PAGE_SIZE) + 1,
            pageSize: PAGE_SIZE,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
          actions={[
            {
              label: copy.viewDetails,
              icon: <Eye className="size-4" />,
              onClick: (member) => setDetailId(member.id),
            },
            {
              label: copy.editCustomer,
              icon: <Pencil className="size-4" />,
              show: () => canManage,
              onClick: (member) => setEditing(member),
            },
            {
              label: copy.deactivate,
              icon: <CircleOff className="size-4" />,
              show: (member) => canManage && member.status === 'ACTIVE',
              onClick: (member) => setStatusTarget(member),
            },
            {
              label: copy.activate,
              icon: <CircleCheck className="size-4" />,
              show: (member) => canManage && member.status === 'INACTIVE',
              onClick: (member) => setStatusTarget(member),
            },
          ]}
        />
      </div>

      {editing !== undefined ? (
        <MemberEditor
          member={editing}
          api={api}
          canLookupCustomers={session.access.permissions.includes('customers:read')}
          done={refresh}
          close={() => setEditing(undefined)}
        />
      ) : null}

      {detailId ? (
        <MemberDetailDialog
          memberId={detailId}
          api={api}
          canViewLoyalty={canViewLoyalty}
          canEdit={canManage}
          formatDate={formatDate}
          onEdit={(member) => {
            setDetailId(null);
            setEditing(member);
          }}
          onClose={() => setDetailId(null)}
        />
      ) : null}

      {importing ? (
        <MemberImportDialog
          api={api}
          openingPointsAvailable={
            session.access.capabilities.includes('LOYALTY_POINTS') &&
            session.access.permissions.includes('loyalty:configure')
          }
          onImported={refresh}
          onClose={() => setImporting(false)}
        />
      ) : null}

      <DConfirmDialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void confirmStatus()}
        loading={changingStatus}
        title={statusTarget?.status === 'ACTIVE' ? copy.deactivateTitle : copy.activateTitle}
        message={
          <>
            <span className="block font-medium text-[var(--color-text)]">
              {statusTarget?.customer.name} · {statusTarget?.memberNumber}
            </span>
            <span className="mt-1 block">{copy.statusMessage}</span>
          </>
        }
        confirmLabel={
          statusTarget?.status === 'ACTIVE' ? copy.deactivateConfirm : copy.activateConfirm
        }
        cancelLabel={copy.cancel}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
      />
    </BackofficePage>
  );
}
