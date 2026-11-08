/**
 * Error reports to Sentry – only when SENTRY_DSN is set (free account at sentry.io, EU region).
 * Without it, errors are just logged as before.
 */
type SentryLike = { captureException(e: unknown): void; captureMessage(m: string): void };
let sentry: SentryLike | null = null;

export async function initMonitoring(dsn = process.env.SENTRY_DSN) {
  if (!dsn) return;
  const S = await import('@sentry/node');
  S.init({
    dsn,
    environment: process.env.HUTEL_JUNIOR === 'true' ? 'junior' : 'production',
    tracesSampleRate: 0,
  });
  sentry = S;
  process.on('uncaughtException', (e) => {
    console.error(e);
    S.captureException(e);
  });
  process.on('unhandledRejection', (e) => {
    console.error(e);
    S.captureException(e);
  });
  console.log('Fejlrapporter sendes til Sentry');
}

export function reportError(e: unknown) {
  sentry?.captureException(e);
}

/** Something unusual (not an exception) worth an alert, e.g. a burst of coins. */
export function reportWarning(msg: string) {
  console.warn(`[alarm] ${msg}`);
  sentry?.captureMessage(msg);
}
