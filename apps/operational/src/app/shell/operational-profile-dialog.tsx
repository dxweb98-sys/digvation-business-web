import { DAlert, DAvatar, DBadge, DButton, DDialog, useToast } from '@digvation/ui';
import { AtSign, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useOperationalLocalization } from '../localization/operational-localization';
import { OperationalProfileApi, type OperationalSelfProfile } from './operational-profile-api';

/** Every Operational user receives this read-only account overview from Runtime. */
export function OperationalProfileDialog({
  open,
  onClose,
  apiBaseUrl,
  getAccessToken,
}: {
  open: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null>;
}) {
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const api = useMemo(
    () => new OperationalProfileApi(apiBaseUrl, getAccessToken),
    [apiBaseUrl, getAccessToken],
  );
  const [profile, setProfile] = useState<OperationalSelfProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadFailed(false);
    setMessage(null);
    void api
      .getSelf()
      .then((next) => {
        setProfile(next);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [api, loadAttempt, open]);

  const verify = async () => {
    if (sendingVerification) return;
    setSendingVerification(true);
    try {
      await api.requestEmailVerification();
      showToast({ variant: 'success', title: copy('Verification link sent.') });
    } catch {
      setMessage(copy('Could not send the verification link.'));
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Profile')}
      className="w-full max-w-md"
      footer={
        <div className="flex justify-end">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
        </div>
      }
    >
      {loading ? (
        <p role="status" className="text-sm text-(--color-text-muted)">
          {copy('Loading...')}
        </p>
      ) : profile ? (
        <ProfileOverview
          profile={profile}
          sendingVerification={sendingVerification}
          onRequestVerification={() => void verify()}
        />
      ) : (
        <div className="space-y-3">
          <DAlert variant="danger" role="alert">
            {loadFailed ? copy('Could not load your profile.') : copy('Loading...')}
          </DAlert>
          {loadFailed ? (
            <DButton
              size="sm"
              variant="secondary"
              onClick={() => setLoadAttempt((value) => value + 1)}
            >
              {copy('Try again')}
            </DButton>
          ) : null}
        </div>
      )}
      {message && profile ? (
        <DAlert variant="danger" role="alert" className="mt-4">
          {message}
        </DAlert>
      ) : null}
    </DDialog>
  );
}

function ProfileOverview({
  profile,
  sendingVerification,
  onRequestVerification,
}: {
  profile: OperationalSelfProfile;
  sendingVerification: boolean;
  onRequestVerification: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const emailVerified = Boolean(profile.email && profile.emailVerifiedAt);

  return (
    <div className="space-y-4">
      <section className="border-b border-(--color-border) pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <DAvatar
              alt=""
              name={profile.displayName}
              fallback={<UserRound className="size-5" aria-hidden="true" />}
              size="lg"
              className="shrink-0 bg-(--color-surface-muted) text-sm font-bold text-(--color-brand)"
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-(--color-text)">
                {profile.displayName}
              </h2>
              <p className="mt-0.5 truncate text-sm text-(--color-text-muted)">
                {profile.username ? `@${profile.username}` : copy('Account')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.roles.map((role) => (
                  <DBadge key={role.id} variant={role.systemKey === 'OWNER' ? 'info' : 'secondary'}>
                    {role.name}
                  </DBadge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-(--color-text-muted)">
          {copy('Account details')}
        </p>
        <dl className="mt-3 divide-y divide-(--color-border) rounded-(--radius-control) border border-(--color-border)">
          <ProfileDetail
            label={copy('Display name')}
            value={profile.displayName}
            icon={<UserRound className="size-3.5" aria-hidden="true" />}
          />
          <ProfileDetail
            label={copy('Sign-in username')}
            value={profile.username ? `@${profile.username}` : '—'}
            icon={<AtSign className="size-3.5" aria-hidden="true" />}
          />
          <ProfileDetail
            label={copy('Phone number')}
            value={formatPhoneNumber(profile.phoneE164)}
            icon={<Phone className="size-3.5" aria-hidden="true" />}
          />
        </dl>
      </section>

      <section className="border-t border-(--color-border) pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--color-brand)/10 text-(--color-brand)">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-(--color-text-muted)">
                {copy('Email')}
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-(--color-text)">
                {profile.email ?? copy('Email not set')}
              </p>
            </div>
          </div>
          <DBadge variant={emailVerified ? 'success' : 'secondary'}>
            {copy(emailVerified ? 'Verified' : 'Not verified')}
          </DBadge>
        </div>
        <div className="mt-4 rounded-xl border border-(--color-border) bg-(--color-surface-muted)/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0 text-(--color-brand)"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-(--color-text)">{copy('Email security')}</p>
              <p className="mt-1 text-xs leading-5 text-(--color-text-muted)">
                {profile.email
                  ? emailVerified
                    ? copy('Password links are sent only to your verified email.')
                    : copy('Verify this email before it can receive password links.')
                  : copy('Ask an administrator to add or update your email.')}
              </p>
              {profile.email && !emailVerified ? (
                <DButton
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  loading={sendingVerification}
                  onClick={onRequestVerification}
                >
                  {copy('Send verification link')}
                </DButton>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatPhoneNumber(phoneE164: string | null): string {
  if (!phoneE164) return '—';
  return phoneE164.startsWith('+62') ? `0${phoneE164.slice(3)}` : phoneE164;
}

function ProfileDetail({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 px-3 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-(--color-text-muted)">
        <span className="text-(--color-brand)">{icon}</span>
        {label}
      </dt>
      <dd className="wrap-break-word text-right text-sm font-semibold text-(--color-text)">
        {value}
      </dd>
    </div>
  );
}
