import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';

const server = createApp('http://localhost:5173');
let base = '';

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('server', () => {
  it('answers health checks', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, service: 'hutel-server' });
  });

  it('returns 404 for unknown paths', async () => {
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });
});
