import { ROOM_SIZE } from '@hutel/shared';

const serverUrl = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:2567';
const status = document.getElementById('status')!;

async function checkServer(): Promise<void> {
  try {
    const res = await fetch(`${serverUrl}/health`);
    const data = (await res.json()) as { ok: boolean; version: string };
    status.textContent = data.ok
      ? `✅ Serveren svarer (version ${data.version}) · rum på ${ROOM_SIZE}×${ROOM_SIZE} felter`
      : '⚠️ Serveren svarede, men ikke som forventet';
  } catch {
    status.textContent = '❌ Kan ikke nå serveren – kører den? (pnpm dev)';
  }
}

void checkServer();
