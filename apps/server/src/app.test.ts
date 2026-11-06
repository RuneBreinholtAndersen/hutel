import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { DEFAULT_LOOK, type ServerMsg } from '@hutel/shared';
import { createApp } from './app';

const cfg = {
  clientOrigins: ['http://localhost:5173'],
  dataFile: null,
  clientDist: null,
  onboardingLock: false,
  botModel: 'test',
  botMaxCallsPerDay: 0,
  signupsPerHour: 1000,
};
const app = createApp(cfg);
let base = '';

beforeAll(async () => {
  await new Promise<void>((r) => app.server.listen(0, r));
  base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterAll(() => app.close());

async function guest(name: string) {
  const res = await fetch(`http://${base}/api/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      look: DEFAULT_LOOK,
      password: 'hemmelig123',
      adult: true,
      terms: true,
    }),
  });
  return (await res.json()) as { ok: boolean; token: string; userId: string; error?: string };
}

class TestClient {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  constructor() {
    this.ws = new WebSocket(`ws://${base}/ws`, { headers: { origin: 'http://localhost:5173' } });
    this.ws.on('message', (d) => this.msgs.push(JSON.parse(d.toString()) as ServerMsg));
  }
  open() {
    return new Promise<void>((r) => this.ws.once('open', () => r()));
  }
  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }
  async waitFor<T extends ServerMsg['t']>(
    t: T,
    pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true,
    ms = 2000,
  ) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const m = this.msgs.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) {
        this.msgs.splice(this.msgs.indexOf(m), 1);
        return m as Extract<ServerMsg, { t: T }>;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timeout waiting for ${t}`);
  }
}

async function login(name: string) {
  const g = await guest(name);
  expect(g.ok).toBe(true);
  const c = new TestClient();
  await c.open();
  c.send({ t: 'auth', token: g.token });
  const welcome = await c.waitFor('welcome');
  const room = await c.waitFor('room');
  return { c, g, welcome, room };
}

describe('http', () => {
  it('answers health checks', async () => {
    const res = await fetch(`http://${base}/health`);
    expect(await res.json()).toMatchObject({ ok: true, service: 'hutel-server' });
  });
  it('rejects bad names, duplicates and missing consent', async () => {
    expect((await guest('<b>x</b>')).ok).toBe(false);
    expect((await guest('Ida')).ok).toBe(false);
    const res = await fetch(`http://${base}/api/guest`, {
      method: 'POST',
      body: JSON.stringify({ name: 'NoConsent', look: DEFAULT_LOOK }),
    });
    expect(res.status).toBe(400);
  });
});

describe('websocket origins', () => {
  const tryOrigin = (origin: string, host?: string) =>
    new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://${base}/ws`, {
        headers: { origin, ...(host ? { host } : {}) },
      });
      ws.on('open', () => {
        ws.close();
        resolve(true);
      });
      ws.on('error', () => resolve(false));
    });
  it('accepts its own host and configured origins, rejects others', async () => {
    expect(await tryOrigin('http://localhost:5173')).toBe(true);
    expect(await tryOrigin(`http://${base}`)).toBe(true);
    expect(await tryOrigin('https://evil.example')).toBe(false);
  });
});

describe('login', () => {
  it('logs in with name and password and rejects wrong passwords', async () => {
    const g = await guest('Loginbruger');
    expect(g.ok).toBe(true);
    const post = (body: unknown) =>
      fetch(`http://${base}/api/login`, { method: 'POST', body: JSON.stringify(body) }).then(
        async (r) => ({
          status: r.status,
          data: (await r.json()) as { ok: boolean; token?: string },
        }),
      );
    expect((await post({ name: 'loginbruger', password: 'forkert' })).status).toBe(401);
    const ok = await post({ name: 'Loginbruger', password: 'hemmelig123' });
    expect(ok.data.ok).toBe(true);
    expect(ok.data.token).not.toBe(g.token);
  });
  it('rejects short passwords', async () => {
    const res = await fetch(`http://${base}/api/guest`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Kortkode',
        look: DEFAULT_LOOK,
        password: '123',
        adult: true,
        terms: true,
      }),
    });
    expect(res.status).toBe(400);
  });
  it('requires an invite code when the beta is closed', async () => {
    const closed = createApp({ ...cfg, inviteCodes: ['KAGE2026'] });
    await new Promise<void>((r) => closed.server.listen(0, r));
    const port = (closed.server.address() as AddressInfo).port;
    const send = (invite?: string) =>
      fetch(`http://127.0.0.1:${port}/api/guest`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Betagæst',
          look: DEFAULT_LOOK,
          password: 'hemmelig123',
          invite,
          adult: true,
          terms: true,
        }),
      });
    expect((await send()).status).toBe(403);
    expect((await send('forkert')).status).toBe(403);
    expect((await send('kage2026')).status).toBe(200);
    await closed.close();
  });
});

describe('social login (Supabase)', () => {
  it('maps a verified identity to one game account, asking for a profile the first time', async () => {
    const sb = createApp({
      ...cfg,
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'anon',
      verifyAuthToken: async (t) => (t.startsWith('good-') ? { id: t.slice(5) } : null),
    });
    await new Promise<void>((r) => sb.server.listen(0, r));
    const port = (sb.server.address() as AddressInfo).port;
    const post = async (body: unknown) => {
      const r = await fetch(`http://127.0.0.1:${port}/api/session`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return { status: r.status, body: (await r.json()) as Record<string, unknown> };
    };
    const conf = (await (await fetch(`http://127.0.0.1:${port}/api/config`)).json()) as {
      auth: string;
    };
    expect(conf.auth).toBe('supabase');
    expect((await post({ accessToken: 'bad-token-123' })).status).toBe(401);
    const first = await post({ accessToken: 'good-user-1' });
    expect(first.body.needsProfile).toBe(true);
    const profile = { name: 'Googler', look: DEFAULT_LOOK, adult: true, terms: true };
    const created = await post({ accessToken: 'good-user-1', profile });
    expect(created.body.ok).toBe(true);
    const again = await post({ accessToken: 'good-user-1' });
    expect(again.body.userId).toBe(created.body.userId);
    expect(again.body.token).toBeTruthy();
    const dup = await post({ accessToken: 'good-user-2', profile });
    expect(dup.status).toBe(409);
    await sb.close();
  });

  it('reports password mode when Supabase is not configured', async () => {
    const r = (await (await fetch(`http://${base}/api/config`)).json()) as { auth: string };
    expect(r.auth).toBe('password');
    expect((await fetch(`http://${base}/api/session`, { method: 'POST', body: '{}' })).status).toBe(
      404,
    );
  });
});

describe('multiplayer', () => {
  it('puts a new guest in their own room with default furniture and 30 coins', async () => {
    const { welcome, room, c } = await login('Rune');
    expect(welcome.me.coins).toBe(30);
    expect(room.room.id).toBe(welcome.me.homeRoomId);
    expect(room.room.items.length).toBeGreaterThan(3);
    expect(room.room.canBuild).toBe(true);
    c.ws.close();
  });

  it('lets two players see each other move and chat in the lobby, with bots present', async () => {
    const a = await login('Tina');
    const b = await login('Finn');
    a.c.send({ t: 'join', roomId: 'lobby' });
    const lobbyA = await a.c.waitFor('room', (m) => m.room.id === 'lobby');
    expect(lobbyA.room.players.some((p) => p.bot && p.name === 'Ida')).toBe(true);
    b.c.send({ t: 'join', roomId: 'lobby' });
    await b.c.waitFor('room', (m) => m.room.id === 'lobby');
    const joined = await a.c.waitFor('playerJoin', (m) => m.player.name === 'Finn');
    expect(joined.player.bot).toBe(false);

    b.c.send({ t: 'move', x: 5, z: 5 });
    const path = await a.c.waitFor('path', (m) => m.id === b.g.userId);
    expect(path.path.at(-1)).toEqual([5, 5]);

    b.c.send({ t: 'chat', text: 'hej med jer, det er fuck godt' });
    const chat = await a.c.waitFor('chat', (m) => m.id === b.g.userId);
    expect(chat.text).toBe('hej med jer, det er **** godt');
    await b.c.waitFor('quest', (m) => m.id === 'hello');
    // Ida (host) usually greets back — fallback lines without an API key.
    a.c.ws.close();
    b.c.ws.close();
  });

  it('rejects invalid and unauthorised actions', async () => {
    const { c, welcome } = await login('Hacker');
    c.send({ t: 'give_me_coins', amount: 99999 });
    c.send({ t: 'move', x: -3, z: 0 });
    c.send({ t: 'buy', type: 'desk', x: 4, z: 4, rot: 0 });
    c.send({ t: 'buy', type: 'bed', x: 4, z: 4, rot: 0 });
    await c.waitFor('itemPut', (m) => m.item.type === 'bed');
    expect(c.msgs.some((m) => m.t === 'itemPut' && m.item.type === 'desk')).toBe(false);
    c.send({ t: 'buy', type: 'bed', x: 6, z: 5, rot: 0 });
    const toast = await c.waitFor('toast');
    expect(toast.text).toMatch(/mønter/);
    c.send({ t: 'join', roomId: 'lobby' });
    await c.waitFor('room', (m) => m.room.id === 'lobby');
    c.send({ t: 'moveItem', id: 1001, x: 0, z: 0, rot: 0 });
    expect((await c.waitFor('toast')).text).toMatch(/rettigheder/);
    expect(welcome.me.coins).toBe(30);
    c.ws.close();
  });

  it('buys, moves and sells furniture with server-side coins', async () => {
    const { c } = await login('Byggemand');
    c.send({ t: 'buy', type: 'plant', x: 6, z: 6, rot: 0 });
    const put = await c.waitFor('itemPut');
    expect(put.item.type).toBe('plant');
    expect((await c.waitFor('coins')).coins).toBe(24);
    await c.waitFor('quest', (m) => m.id === 'buy');
    c.send({ t: 'moveItem', id: put.item.id, x: 7, z: 7, rot: 0 });
    expect((await c.waitFor('itemPut', (m) => m.item.id === put.item.id)).item.x).toBe(7);
    c.send({ t: 'sellItem', id: put.item.id });
    await c.waitFor('itemRemove');
    c.ws.close();
  });

  it('handles friends, whispers, password rooms and blocking', async () => {
    const a = await login('Anna');
    const b = await login('Bo');
    a.c.send({ t: 'whisper', to: b.g.userId, text: 'hej' });
    expect((await a.c.waitFor('toast')).text).toMatch(/venner/);
    a.c.send({ t: 'friendRequest', name: 'bo' });
    await b.c.waitFor('friends', (m) => m.requests.some((r) => r.name === 'Anna'));
    b.c.send({ t: 'friendRespond', userId: a.g.userId, accept: true });
    await a.c.waitFor('friends', (m) => m.friends.some((f) => f.name === 'Bo' && f.online));
    a.c.send({ t: 'whisper', to: b.g.userId, text: 'hemmeligt' });
    expect((await b.c.waitFor('whisper')).text).toBe('hemmeligt');

    a.c.send({ t: 'roomSettings', access: 'password', password: 'kage123' });
    await a.c.waitFor('roomMeta');
    b.c.send({ t: 'join', roomId: a.welcome.me.homeRoomId });
    await b.c.waitFor('needPassword');
    b.c.send({ t: 'join', roomId: a.welcome.me.homeRoomId, password: 'forkert' });
    expect((await b.c.waitFor('toast', (m) => /Forkert/.test(m.text))).kind).toBe('error');
    b.c.send({ t: 'join', roomId: a.welcome.me.homeRoomId, password: 'kage123' });
    await b.c.waitFor('room', (m) => m.room.id === a.welcome.me.homeRoomId);

    a.c.send({ t: 'block', userId: b.g.userId, block: true });
    await a.c.waitFor('toast', (m) => /Blokeret/.test(m.text));
    b.c.send({ t: 'chat', text: 'kan du se mig?' });
    await new Promise((r) => setTimeout(r, 200));
    expect(a.c.msgs.some((m) => m.t === 'chat' && m.id === b.g.userId)).toBe(false);
    a.c.ws.close();
    b.c.ws.close();
  });
});
