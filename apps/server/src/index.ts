import { resolve } from 'node:path';
import { createApp } from './app';

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
  authProviders: (process.env.AUTH_PROVIDERS ?? 'google')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  botModel: process.env.BOT_MODEL ?? 'claude-haiku-5-5',
  botMaxCallsPerDay: Number(process.env.BOT_MAX_CALLS_PER_DAY ?? 300),
});

app.server.listen(port, () => {
  console.log(
    `Hutel-server kører på http://localhost:${port}  (ws: /ws, AI-beboere: ${app.hotel.aiEnabled ? 'Anthropic' : 'faste replikker'})`,
  );
});

const shutdown = () => {
  console.log('Lukker ned og gemmer data…');
  void app.close().then(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
