import { DAlert, DButton, DDialog, DInput, useToast } from '@digvation/ui';
import { Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useOperationalLocalization } from '../localization/operational-localization';
import type { OperationalPasswordChangePort } from './operational-password-change';
import { OperationalProfileApi, type OperationalSelfProfile } from './operational-profile-api';

export function OperationalProfileDialog({ open, onClose, apiBaseUrl, getAccessToken, passwordChange }: { open: boolean; onClose: () => void; apiBaseUrl: string; getAccessToken: () => Promise<string | null>; passwordChange: OperationalPasswordChangePort }) {
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const api = useMemo(() => new OperationalProfileApi(apiBaseUrl, getAccessToken), [apiBaseUrl, getAccessToken]);
  const [profile, setProfile] = useState<OperationalSelfProfile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { if (!open) return; setLoading(true); setMessage(null); void api.getSelf().then((next) => { setProfile(next); setEmail(next.email ?? ''); }).catch(() => setMessage(copy('Could not load your profile.'))).finally(() => setLoading(false)); }, [api, copy, open]);
  const save = async () => { if (!profile || saving) return; setSaving(true); try { const next = await api.updateSelf({ email: email.trim() || null }); setProfile(next); setEmail(next.email ?? ''); showToast({ variant: 'success', title: copy('Profile updated.') }); } catch { setMessage(copy('Could not update your profile.')); } finally { setSaving(false); } };
  const verify = async () => { try { await api.requestEmailVerification(); showToast({ variant: 'success', title: copy('Verification link sent.') }); } catch { setMessage(copy('Could not send the verification link.')); } };
  const password = async () => { try { await passwordChange.requestResetLink(); showToast({ variant: 'success', title: copy('Password link sent to your verified email.') }); } catch { setMessage(copy('A verified email is required before a password link can be sent.')); } };
  return <DDialog open={open} onClose={onClose} title={copy('Profile')} description={copy('Your account information and security settings.')} className="w-full max-w-md" footer={<div className="flex justify-end gap-2"><DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton><DButton loading={saving} disabled={!profile || email.trim() === (profile?.email ?? '')} onClick={() => void save()}>{copy('Save changes')}</DButton></div>}>
    {loading ? <p role="status" className="text-sm text-[var(--color-text-muted)]">{copy('Loading...')}</p> : profile ? <div className="space-y-4"><section className="rounded-[var(--radius-control)] border border-[var(--color-border)] p-3"><p className="text-sm font-semibold">{profile.displayName}</p><p className="mt-1 text-xs text-[var(--color-text-muted)]">{profile.username ? `@${profile.username}` : copy('Account')}</p><p className="mt-3 text-xs text-[var(--color-text-muted)]">{copy('Verified phone number')}</p><p className="text-sm">{profile.phoneE164}</p></section><section className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3"><div className="flex items-center gap-2"><Mail className="size-4 text-[var(--color-brand)]" aria-hidden="true"/><p className="text-sm font-semibold">{copy('Email')}</p></div><DInput label={copy('Email')} type="email" inputMode="email" autoComplete="email" value={email} onChange={setEmail} disabled={saving}/><p className="text-xs text-[var(--color-text-muted)]">{profile.emailVerifiedAt ? copy('Verified. Password links are sent to this address.') : copy('Unverified. Confirm the ownership link before password links can be sent.')}</p>{profile.email && !profile.emailVerifiedAt && email === profile.email ? <DButton size="sm" variant="secondary" onClick={() => void verify()}>{copy('Send verification link')}</DButton> : null}</section><section className="space-y-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-[var(--color-brand)]" aria-hidden="true"/><p className="text-sm font-semibold">{copy('Password')}</p></div><p className="text-xs leading-5 text-[var(--color-text-muted)]">{copy('A secure link opens the password-setting page. Your password is never entered here.')}</p><DButton size="sm" variant="secondary" onClick={() => void password()}>{copy('Send password link')}</DButton></section>{message ? <DAlert variant="danger" role="alert">{message}</DAlert> : null}</div> : <DAlert variant="danger" role="alert">{message ?? copy('Could not load your profile.')}</DAlert>}
  </DDialog>;
}
