import {
  type DeploymentBootstrapConfig,
  HttpDeploymentBootstrapAdapter,
  resolveBootstrapWorkspace,
} from '@digvation/business-runtime';

const configuredApi = import.meta.env.VITE_RUNTIME_API_URL ?? '';
let apiBase = configuredApi;
let bootstrapConfig: Promise<DeploymentBootstrapConfig | undefined> | undefined;

export class PortalRequestError extends Error {
  constructor(readonly status: number) {
    super('Member portal request failed');
  }
}

/** Thrown when the deployment does not identify which business this portal serves. */
export class PortalWorkspaceUnavailableError extends Error {
  constructor() {
    super('Member portal business context is unavailable');
  }
}

/**
 * Deployment bootstrap, loaded once per page. The business is a public routing locator taken from
 * it, exactly like Business sign-in: never a credential and never a tenant/member identifier
 * typed or chosen in the browser.
 */
export function loadBootstrap(): Promise<DeploymentBootstrapConfig | undefined> {
  bootstrapConfig ??= new HttpDeploymentBootstrapAdapter(
    `${import.meta.env.BASE_URL}runtime-config.json`,
  )
    .load()
    .then((bootstrap) => {
      apiBase = bootstrap.apiBaseUrl || configuredApi;
      return bootstrap;
    })
    .catch(() => {
      bootstrapConfig = undefined;
      return undefined;
    });
  return bootstrapConfig;
}

async function resolveWorkspace(): Promise<string | undefined> {
  const bootstrap = await loadBootstrap();
  return bootstrap ? resolveBootstrapWorkspace(bootstrap) : undefined;
}

export async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}/api/v1/member-portal${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new PortalRequestError(response.status);
  const payload = await response.json();
  return payload?.data ?? payload;
}

/**
 * The field renders a fixed +62 prefix, so the editable value is the national mobile number
 * without a leading 0 or country code: `0812…`, `62812…`, `+62812…` and `812…` all show `812…`.
 */
export function localPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
  return digits.startsWith('62') ? digits.slice(2).replace(/^0+/, '') : digits;
}

/** Canonical authority: +62… */
export function canonicalPhone(raw: string) {
  return `+62${localPhoneInput(raw)}`;
}

export function isValidIndonesianPhone(raw: string) {
  return /^\+62\d{8,13}$/.test(canonicalPhone(raw));
}

export interface OtpChallenge {
  challengeId: string;
  resendAfterSeconds: number;
}

export async function requestOtp(phone: string): Promise<OtpChallenge> {
  const workspace = await resolveWorkspace();
  if (!workspace) throw new PortalWorkspaceUnavailableError();
  const result = await call('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ workspace, phone: canonicalPhone(phone) }),
  });
  if (!result.challengeId) throw new PortalRequestError(503);
  return {
    challengeId: result.challengeId,
    resendAfterSeconds: Number(result.resendAfterSeconds) || 60,
  };
}

export function verifyOtp(challengeId: string, code: string) {
  return call('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code }),
  });
}

export function logout() {
  return call('/auth/logout', { method: 'POST' });
}

/** A valid Member Portal session skips OTP; the server alone decides validity. */
export async function currentSession() {
  await loadBootstrap();
  return call('/summary');
}
