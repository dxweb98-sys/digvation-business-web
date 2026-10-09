import { DBadge, DButton, DDialog, DInfoNote } from '@digvation/ui';
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileSpreadsheet,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { readStoredBackofficeLocale } from '../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type {
  MemberImportPreview,
  MemberImportRow,
  MemberImportSummary,
  MembersApi,
} from './members-api';
import { memberImportIssueText, membershipCopy } from './membership-copy';
import {
  MEMBER_IMPORT_TEMPLATE_FILE_NAME,
  formatFileSize,
  formatImportPoints,
  hasImportOpeningPoints,
  memberImportFileProblem,
  memberImportPreviewRows,
} from './member-import-model';
import { MemberDialogTitle, MemberPanel, MemberSectionLabel } from './membership-surfaces';
import { toNationalMemberPhone } from './member-phone';

type Step =
  | { kind: 'file' }
  | { kind: 'preview'; preview: MemberImportPreview; rejectedAtImport: boolean }
  | { kind: 'result'; summary: MemberImportSummary };

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Member import: download the blank template, validate a filled `.xlsx` (Runtime preview), then
 * import every row atomically. Import stays unavailable while any row has an error.
 */
export function MemberImportDialog({
  api,
  openingPointsAvailable,
  onImported,
  onClose,
}: {
  api: Pick<MembersApi, 'importTemplate' | 'previewImport' | 'importMembers'>;
  /**
   * Presentation hint only: whether Loyalty Points and `loyalty:configure` are present. Runtime
   * rejects positive Poin Awal rows on its own; import itself stays governed by enrollment.
   */
  openingPointsAvailable: boolean;
  onImported: () => void;
  onClose: () => void;
}) {
  const copy = membershipCopy();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'file' });
  const [busy, setBusy] = useState<'template' | 'preview' | 'import' | null>(null);

  const failure = (error: unknown) =>
    isSessionExpiredError(error) ? null : normalizeBackofficeApiError(error).safeMessage;

  const choose = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = memberImportFileProblem(candidate);
    if (problem) {
      setFileError(
        problem === 'type'
          ? copy.fileTypeInvalid
          : problem === 'size'
            ? copy.fileTooLarge
            : copy.fileEmpty,
      );
      return;
    }
    setFile(candidate);
    setFileError(null);
    setStep({ kind: 'file' });
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      saveBlob(await api.importTemplate(), MEMBER_IMPORT_TEMPLATE_FILE_NAME);
    } catch (error) {
      const message = failure(error);
      if (message) setFileError(`${copy.templateFailed} ${message}`);
    } finally {
      setBusy(null);
    }
  };

  const validate = async () => {
    if (!file || busy) return;
    setBusy('preview');
    try {
      setStep({ kind: 'preview', preview: await api.previewImport(file), rejectedAtImport: false });
    } catch (error) {
      setFileError(failure(error));
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!file || busy || step.kind !== 'preview' || !step.preview.canImport) return;
    setBusy('import');
    try {
      const result = await api.importMembers(file);
      if (result.outcome === 'IMPORTED' && result.summary) {
        onImported();
        setStep({ kind: 'result', summary: result.summary });
      } else setStep({ kind: 'preview', preview: result.preview, rejectedAtImport: true });
    } catch (error) {
      setFileError(failure(error));
      setStep({ kind: 'file' });
    } finally {
      setBusy(null);
    }
  };

  const footer =
    step.kind === 'result' ? (
      <div className="flex justify-end">
        <DButton onClick={onClose}>{copy.done}</DButton>
      </div>
    ) : step.kind === 'preview' ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DButton
          variant="secondary"
          disabled={busy !== null}
          onClick={() => setStep({ kind: 'file' })}
        >
          {copy.back}
        </DButton>
        <DButton
          leftIcon={<Upload className="size-4" />}
          disabled={!step.preview.canImport || busy !== null}
          onClick={() => void runImport()}
        >
          {busy === 'import' ? copy.importing : copy.importAction}
        </DButton>
      </div>
    ) : (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DButton variant="secondary" disabled={busy !== null} onClick={onClose}>
          {copy.cancel}
        </DButton>
        <DButton disabled={!file || busy !== null} onClick={() => void validate()}>
          {busy === 'preview' ? copy.validating : copy.validate}
        </DButton>
      </div>
    );

  return (
    <DDialog
      open
      onClose={busy === 'import' ? () => undefined : onClose}
      size="xl"
      title={<MemberDialogTitle title={copy.importTitle} />}
      footer={footer}
    >
      {step.kind === 'result' ? (
        <ImportResult summary={step.summary} />
      ) : step.kind === 'preview' ? (
        <ImportPreview
          preview={step.preview}
          rejectedAtImport={step.rejectedAtImport}
          fileName={file?.name ?? ''}
        />
      ) : (
        <div className="space-y-4">
          <MemberPanel className="p-5">
            <MemberSectionLabel>{copy.downloadTemplate}</MemberSectionLabel>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                {copy.importIntro} {copy.templateHint}
              </p>
              <DButton
                variant="secondary"
                size="sm"
                leftIcon={<Download className="size-4" />}
                disabled={busy !== null}
                onClick={() => void downloadTemplate()}
                className="shrink-0"
              >
                {copy.downloadTemplate}
              </DButton>
            </div>
            {openingPointsAvailable ? null : (
              <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
                {copy.openingPointsUnavailable}
              </p>
            )}
          </MemberPanel>

          <MemberPanel className="p-5">
            <MemberSectionLabel>{copy.chooseFile}</MemberSectionLabel>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                choose(event.dataTransfer.files?.[0]);
              }}
              className="mt-3 flex w-full flex-col items-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/25 px-4 py-6 text-center transition-colors hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/[0.025] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="grid size-10 place-items-center rounded-full bg-[var(--color-brand)]/8 text-[var(--color-brand)]">
                <FileSpreadsheet className="size-5" aria-hidden="true" />
              </span>
              {file ? (
                <>
                  <span className="mt-2 max-w-full break-all text-sm font-semibold text-[var(--color-text)]">
                    {file.name}
                  </span>
                  <span className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {formatFileSize(file.size)} · {copy.replaceFile}
                  </span>
                </>
              ) : (
                <>
                  <span className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                    {copy.chooseFile}
                  </span>
                  <span className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {copy.dropHint}
                  </span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              aria-label={copy.chooseFile}
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                choose(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            {fileError ? (
              <p role="alert" className="mt-2 text-xs leading-5 text-[var(--color-danger)]">
                {fileError}
              </p>
            ) : null}
          </MemberPanel>
        </div>
      )}
    </DDialog>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
}) {
  const color = {
    neutral: 'text-[var(--color-text)]',
    success: 'text-[var(--color-success)]',
    danger: 'text-[var(--color-danger)]',
    warning: 'text-[var(--color-warning)]',
  }[tone];
  return (
    <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ImportPreview({
  preview,
  rejectedAtImport,
  fileName,
}: {
  preview: MemberImportPreview;
  rejectedAtImport: boolean;
  fileName: string;
}) {
  const copy = membershipCopy();
  const rows = memberImportPreviewRows(preview.rows);
  return (
    <div className="space-y-4">
      <MemberPanel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MemberSectionLabel>{copy.previewTitle}</MemberSectionLabel>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{fileName}</span>
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label={copy.totalRows} value={preview.totalRows} />
          <SummaryTile label={copy.validRows} value={preview.validRows} tone="success" />
          <SummaryTile
            label={copy.errorRows}
            value={preview.errorRows}
            tone={preview.errorRows ? 'danger' : 'neutral'}
          />
          <SummaryTile
            label={copy.warningRows}
            value={preview.warningRows}
            tone={preview.warningRows ? 'warning' : 'neutral'}
          />
        </div>
        <div className="mt-4">
          <DInfoNote variant={rejectedAtImport || !preview.canImport ? 'danger' : 'success'}>
            {rejectedAtImport
              ? copy.rejectedAtImport
              : preview.canImport
                ? copy.previewReadyHint
                : copy.previewErrorsHint}
          </DInfoNote>
        </div>
      </MemberPanel>

      <MemberPanel>
        {rows.length < preview.rows.length ? (
          <p className="border-b border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
            {copy.previewLimited(rows.length, preview.rows.length)}
          </p>
        ) : null}
        <div className="max-h-[26rem] overflow-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] text-[11px] uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
              <tr>
                {[
                  copy.row,
                  copy.name,
                  copy.phone,
                  copy.memberNumber,
                  copy.status,
                  copy.joinedAt,
                  copy.openingPoints,
                  copy.result,
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-3 py-2 font-semibold ${label === copy.openingPoints ? 'text-right' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {rows.map((row) => (
                <PreviewRow key={row.rowNumber} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </MemberPanel>
    </div>
  );
}

function PreviewRow({ row }: { row: MemberImportRow }) {
  const copy = membershipCopy();
  const muted = (value: ReactNode) => (
    <span className="italic text-[var(--color-text-muted)]">{value}</span>
  );
  const existing = row.existingMember ?? null;
  const locale = readStoredBackofficeLocale();
  return (
    <tr className={row.errors.length ? 'bg-[var(--color-danger)]/[0.04]' : undefined}>
      <td className="px-3 py-2.5 align-top tabular-nums text-[var(--color-text-muted)]">
        {row.rowNumber}
      </td>
      <td className="px-3 py-2.5 align-top font-medium">
        {existing ? existing.name : (row.name ?? muted('—'))}
      </td>
      <td className="px-3 py-2.5 align-top tabular-nums">
        {existing
          ? toNationalMemberPhone(existing.phone)
          : row.phone
            ? toNationalMemberPhone(row.phone)
            : muted('—')}
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-xs">
        {existing ? existing.memberNumber : (row.memberNumber ?? muted(copy.autoNumber))}
      </td>
      <td className="px-3 py-2.5 align-top">
        {row.errors.some((issue) => issue.field === 'status')
          ? muted('—')
          : row.status === 'ACTIVE'
            ? copy.active
            : copy.inactive}
      </td>
      <td className="px-3 py-2.5 align-top tabular-nums">
        {row.joinedDate ?? muted(copy.importTime)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">
        {row.openingPoints === null ? (
          muted('—')
        ) : row.existingMember && hasImportOpeningPoints(row.openingPoints) ? (
          <span className="font-semibold text-[var(--color-text)]">
            +{formatImportPoints(row.openingPoints, readStoredBackofficeLocale())}
          </span>
        ) : row.errors.some((issue) => issue.field === 'openingPoints') ? (
          <span className="text-[var(--color-danger)]">{row.openingPoints}</span>
        ) : hasImportOpeningPoints(row.openingPoints) ? (
          <span className="font-semibold text-[var(--color-text)]">
            {formatImportPoints(row.openingPoints, readStoredBackofficeLocale())}
          </span>
        ) : (
          muted('0')
        )}
      </td>
      <td className="min-w-[14rem] px-3 py-2.5 align-top">
        {row.errors.length ? (
          <DBadge variant="danger">{copy.errorRows}</DBadge>
        ) : (
          <DBadge variant={row.warnings.length ? 'warning' : 'success'}>
            {existing
              ? copy.badgeExistingMember
              : row.action === 'ENROLL_EXISTING_CUSTOMER'
                ? copy.actionEnroll
                : copy.actionCreate}
          </DBadge>
        )}
        {existing ? (
          <dl className="mt-1.5 max-w-[14rem] space-y-0.5 text-xs tabular-nums">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{copy.pointsCurrent}</dt>
              <dd>{formatImportPoints(existing.currentPoints, locale)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--color-text-muted)]">{copy.pointsFromImport}</dt>
              <dd>
                +
                {formatImportPoints(
                  hasImportOpeningPoints(row.openingPoints) ? row.openingPoints! : '0',
                  locale,
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--color-border)] pt-0.5 font-semibold">
              <dt>{copy.pointsResult}</dt>
              <dd>{formatImportPoints(existing.resultingPoints, locale)}</dd>
            </div>
          </dl>
        ) : null}
        {[...row.errors, ...row.warnings].length ? (
          <ul className="mt-1.5 space-y-1">
            {row.errors.map((issue) => (
              <li
                key={`e-${issue.field}-${issue.code}`}
                className="flex gap-1.5 text-xs leading-5 text-[var(--color-danger)]"
              >
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{memberImportIssueText(issue)}</span>
              </li>
            ))}
            {row.warnings.map((issue) => (
              <li
                key={`w-${issue.field}-${issue.code}`}
                className="flex gap-1.5 text-xs leading-5 text-[var(--color-warning)]"
              >
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{memberImportIssueText(issue)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </td>
    </tr>
  );
}

function ImportResult({ summary }: { summary: MemberImportSummary }) {
  const copy = membershipCopy();
  return (
    <MemberPanel className="p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)]">
          <CircleCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-base font-semibold text-[var(--color-text)]">{copy.successTitle}</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {summary.importedCount} {copy.summaryImported.toLowerCase()}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label={copy.summaryCreated} value={summary.createdCustomerCount} />
        <SummaryTile label={copy.summaryEnrolled} value={summary.enrolledExistingCustomerCount} />
        <SummaryTile label={copy.summaryGenerated} value={summary.generatedMemberNumberCount} />
        <SummaryTile label={copy.summaryPreserved} value={summary.preservedMemberNumberCount} />
        {summary.existingMemberPointsCount ? (
          <>
            <SummaryTile
              label={copy.summaryExistingMembers}
              value={summary.existingMemberPointsCount}
            />
            <SummaryTile
              label={copy.summaryExistingPoints}
              value={formatImportPoints(
                summary.existingMemberPointsTotal ?? '0',
                readStoredBackofficeLocale(),
              )}
            />
          </>
        ) : null}
        {summary.openingBalanceMemberCount ? (
          <>
            <SummaryTile
              label={copy.summaryOpeningMembers}
              value={summary.openingBalanceMemberCount}
            />
            <SummaryTile
              label={copy.summaryOpeningPoints}
              value={formatImportPoints(
                summary.openingBalancePointsTotal,
                readStoredBackofficeLocale(),
              )}
            />
          </>
        ) : null}
      </div>
    </MemberPanel>
  );
}
