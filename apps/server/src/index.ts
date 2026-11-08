import { resolve } from 'node:path';
import { createApp } from './app';
import { initMonitoring } from './monitoring';

await initMonitoring();

const port = Number(process.env.PORT ?? 2567);
const origins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = createApp({
  clientOrigins: origins,
  dataFile: resolve(process.env.DATA_FILE ?? 'data/hutel-db.json'),
  clientDist: process.env.SERVE_CLIENT ? resolve(process.env.SERVE_CLIENT) : null,
  onboardingLock: process.env.ONBOARDING_LOCK !== 'false',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  inviteCodes: (process.env.BETA_INVITE_CODES ?? '').split(',').filter((s) => s.trim()),
  supabaseUrl: process.env.SUPABASE_URL || undefined,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || undefined,
  canonicalUrl: process.env.CANONICAL_URL || undefined,
  authProviders: (process.env.AUTH_PROVIDERS ?? 'google')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  claimNames: Object.fromEntries(
    (process.env.CLAIM_NAMES ?? '')
      .split(',')
      .map((pair) => pair.split(':').map((x) => x.trim().toLowerCase()))
      .filter((p) => p.length === 2 && p[0] && p[1]),
  ),
  allowReset: process.env.ALLOW_RESET !== 'false',
  junior: process.env.HUTEL_JUNIOR === 'true',
  adminNames: (process.env.ADMIN_NAMES ?? '')
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean),
  botModel: process.env.BOT_MODEL ?? 'claude-haiku-5-5',
  botMaxCallsPerDay: Number(process.env.BOT_MAX_CALLS_PER_DAY ?? 300),
  sentryDsn: process.env.SENTRY_DSN_BROWSER || undefined,
});

app.server.listen(port, () => {
  console.log(
    `Lobbi-server kører på http://localhost:${port}  (ws: /ws, AI-beboere: ${app.hotel.aiEnabled ? 'Anthropic' : 'faste replikker'})`,
  );
});

let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  console.log('Lukker ned og gemmer data…');
  // Data is saved first thing in close(); don't hang on idle keep-alive connections.
  setTimeout(() => process.exit(0), 2500).unref();
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
