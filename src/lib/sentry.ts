import * as Sentry from '@sentry/react-native';

import { env } from './env';

/**
 * Crash reporting without health data (architecture §15).
 * - sendDefaultPii is off: no IP, no email, no device identifiers beyond what crash grouping needs.
 * - No session replay integration is ever added.
 * - Every event and breadcrumb passes through `scrubEvent` / `scrubBreadcrumb`, which redact anything that
 *   looks like personal or health content before it leaves the device.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

/** Keys whose values are redacted wherever they appear in event data. */
export const SENSITIVE_KEYS = [
  'medication',
  'medications',
  'dose',
  'schedule',
  'reason',
  'transcript',
  'summary',
  'conditions',
  'allergies',
  'diagnosis',
  'notes',
  'body',
  'email',
  'phone',
  'address',
  'date_of_birth',
  'dateOfBirth',
  'display_name',
  'displayName',
  'legal_name',
  'insurance',
  'insurance_summary',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'authorization',
  'cookie',
];

export const REDACTED = '[redacted]';

export function scrubText(input: string): string {
  return input.replace(JWT, REDACTED).replace(EMAIL, REDACTED).replace(PHONE, REDACTED);
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEYS.some(
    (k) => lower === k.toLowerCase() || lower.endsWith(`_${k.toLowerCase()}`),
  );
}

export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED;
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function scrubEvent<E extends Sentry.ErrorEvent>(event: E): E {
  const e = event as E & {
    request?: unknown;
    user?: { id?: string; email?: string; ip_address?: string; username?: string };
    extra?: Record<string, unknown>;
    contexts?: Record<string, unknown>;
    message?: string;
    breadcrumbs?: Sentry.Breadcrumb[];
  };
  delete e.request;
  if (e.user) e.user = { id: e.user.id };
  if (e.extra) e.extra = scrubValue(e.extra) as Record<string, unknown>;
  if (e.contexts) e.contexts = scrubValue(e.contexts) as typeof e.contexts;
  if (e.message) e.message = scrubText(e.message);
  if (e.exception?.values) {
    for (const ex of e.exception.values) {
      if (ex.value) ex.value = scrubText(ex.value);
    }
  }
  if (e.breadcrumbs)
    e.breadcrumbs = e.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter(Boolean) as Sentry.Breadcrumb[];
  return e;
}

export function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  // Network breadcrumbs carry URLs with ids and sometimes bodies; keep only the method and status.
  if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
    const data = (breadcrumb.data ?? {}) as Record<string, unknown>;
    return {
      ...breadcrumb,
      message: undefined,
      data: { method: data.method, status_code: data.status_code },
    };
  }
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubText(breadcrumb.message) : undefined,
    data: breadcrumb.data ? (scrubValue(breadcrumb.data) as Record<string, unknown>) : undefined,
  };
}

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  initialized = true;
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
  });
}

/** Identify the user by opaque id only. */
export function setSentryUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null);
}
