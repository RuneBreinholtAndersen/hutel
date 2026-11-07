import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_LOOK,
  DOOR_TILE as DOOR_TILE_FOR_TEST,
  PROTOCOL_VERSION,
  furniture,
  QUESTS,
  ROOM_CAPACITY,
  type ServerMsg,
} from '@hutel/shared';
import { createApp } from './app';
import { QUIZ as QUIZ_FOR_TEST } from './games';

const cfg = {
  allowReset: true,
  adminNames: ['chefen', 'kassereren'],
  clientOrigins: ['http://localhost:5173'],
  dataFile: null,
  clientDist: null,
  onboardingLock: false,
  botModel: 'test',
  botMaxCallsPerDay: 0,
  signupsPerHour: 1000,
  videoTitles: false,
  chests: false,
  limitedDrops: [
    {
      type: 'nordlyslampe' as const,
      total: 2,
      from: '2000-01-01T00:00:00Z',
      to: '2999-01-01T00:00:00Z',
    },
  ],
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

describe('client updates', () => {
  it('serves index.html uncached, hashed assets forever, and tells old tabs the build id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hutel-dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    writeFileSync(join(dir, 'version.json'), JSON.stringify({ build: 'abc123' }));
    writeFileSync(join(dir, 'assets', 'index-AbCd1234.js'), 'x');
    const app2 = createApp({ ...cfg, clientDist: dir });
    await new Promise<void>((r) => app2.server.listen(0, r));
    const b2 = `127.0.0.1:${(app2.server.address() as AddressInfo).port}`;
    expect((await fetch(`http://${b2}/`)).headers.get('cache-control')).toBe('no-cache');
    expect(
      (await fetch(`http://${b2}/assets/index-AbCd1234.js`)).headers.get('cache-control'),
    ).toMatch(/immutable/);
    const g = (await (
      await fetch(`http://${b2}/api/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Opdatering',
          look: DEFAULT_LOOK,
          password: 'hemmelig123',
          adult: true,
          terms: true,
        }),
      })
    ).json()) as { token: string };
    const ws = new WebSocket(`ws://${b2}/ws`, { headers: { origin: 'http://localhost:5173' } });
    const welcome = await new Promise<ServerMsg>((r) => {
      ws.on('open', () => ws.send(JSON.stringify({ t: 'auth', token: g.token })));
      ws.on('message', (d) => {
        const m = JSON.parse(d.toString()) as ServerMsg;
        if (m.t === 'welcome') r(m);
      });
    });
    expect(welcome.t === 'welcome' && welcome.build).toBe('abc123');
    // Old tabs learn the protocol version and what's new, so they can offer an update.
    expect(welcome.t === 'welcome' && welcome.protocol).toBe(PROTOCOL_VERSION);
    expect(welcome.t === 'welcome' && welcome.notes?.items.length).toBeGreaterThan(0);
    ws.close();
    app2.close();
  });
});

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
      claimNames: { ejer: 'ejerkonto@example.com' },
      verifyAuthToken: async (t) =>
        t.startsWith('good-') ? { id: t.slice(5), email: `${t.slice(5)}@example.com` } : null,
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
    // an old name+password account can be linked to a new social login
    const pw = await fetch(`http://127.0.0.1:${port}/api/guest`, {
      method: 'POST',
      body: JSON.stringify({ ...profile, name: 'Gammel', password: 'hemmelig123' }),
    });
    const oldId = ((await pw.json()) as { userId: string }).userId;
    const wrong = await post({
      accessToken: 'good-user-3',
      profile: { ...profile, name: 'Gammel', password: 'forkert' },
    });
    expect(wrong.status).toBe(401);
    const linked = await post({
      accessToken: 'good-user-3',
      profile: { ...profile, name: 'gammel', password: 'hemmelig123' },
    });
    expect(linked.body.userId).toBe(oldId);
    expect((await post({ accessToken: 'good-user-3' })).body.userId).toBe(oldId);
    // an approved e-mail can take over an old account without its password
    const ej = await fetch(`http://127.0.0.1:${port}/api/guest`, {
      method: 'POST',
      body: JSON.stringify({ ...profile, name: 'Ejer', password: 'glemtglemt' }),
    });
    const ejId = ((await ej.json()) as { userId: string }).userId;
    expect(
      (await post({ accessToken: 'good-nogen', profile: { ...profile, name: 'Ejer' } })).status,
    ).toBe(409);
    const took = await post({
      accessToken: 'good-ejerkonto',
      profile: { ...profile, name: 'Ejer' },
    });
    expect(took.body.userId).toBe(ejId);
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
    // guide-Magnus waits in the room and greets the new guest
    const guide = await c.waitFor('playerJoin', (m) => m.player.name === 'Magnus');
    expect(guide.player.bot).toBe(true);
    expect((await c.waitFor('chat', (m) => m.name === 'Magnus', 4000)).text).toMatch(/Rune/);
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

  it('lets arrow keys glide freely but caps the speed', async () => {
    const a = await login('Glider');
    a.c.send({ t: 'glide', x: 5.6, z: 0.4, run: false });
    const g = await a.c.waitFor('path', (m) => m.id === a.g.userId);
    expect(g.glide).toBe(true);
    expect(g.path[0]![0]).toBeCloseTo(5.6);
    a.c.send({ t: 'glide', x: 0, z: 7, run: false }); // teleport attempt
    const t = await a.c.waitFor('path', (m) => m.id === a.g.userId);
    const end = t.path[0] ?? t.from;
    expect(Math.hypot(end[0] - 5.6, end[1] - 0.4)).toBeLessThan(2);
    a.c.ws.close();
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
    c.send({ t: 'buy', type: 'tv', x: 5, z: 5, rot: 0 });
    expect((await c.waitFor('toast', (m) => /Kræver/.test(m.text))).kind).toBe('error');
    c.send({ t: 'buy', type: 'sofa', x: 4, z: 6, rot: 0, color: 2 });
    expect(
      (await c.waitFor('itemPut', (m) => m.item.type === 'sofa' && m.item.x === 4)).item.color,
    ).toBe(2);
    c.ws.close();
  });

  it('"Start forfra" wipes progress and rebuilds the room', async () => {
    const { c, g, welcome } = await login('Forfra');
    expect(welcome.canReset).toBe(true);
    c.send({ t: 'buy', type: 'plant', x: 6, z: 6, rot: 0 });
    await c.waitFor('quest', (m) => m.id === 'buy');
    c.send({ t: 'reset' });
    await c.waitFor('resetDone');
    c.ws.close();
    const c2 = new TestClient();
    await c2.open();
    c2.send({ t: 'auth', token: g.token });
    const w2 = await c2.waitFor('welcome');
    expect(w2.me.coins).toBe(30);
    expect(w2.me.quests).toEqual([]);
    const r2 = await c2.waitFor('room');
    expect(r2.room.items.some((i) => i.type === 'plant' && i.x === 6 && i.z === 6)).toBe(false);
    c2.ws.close();
  });

  it('unlocks hotel quests in the lobby and café after the start quests', async () => {
    const { c, g } = await login('Turist');
    c.send({ t: 'join', roomId: 'lobby' });
    await c.waitFor('room', (m) => m.room.id === 'lobby');
    await new Promise((r) => setTimeout(r, 100));
    expect(c.msgs.some((m) => m.t === 'quest' && m.id === 'lobby')).toBe(false); // not onboarded yet
    app.store.getUser(g.userId)!.quests.push(...QUESTS.map((q) => q.id));
    c.send({ t: 'join', roomId: 'cafe' });
    await c.waitFor('room', (m) => m.room.id === 'cafe');
    c.send({ t: 'chat', text: 'en kaffe tak' });
    expect((await c.waitFor('quest', (m) => m.id === 'coffee')).reward).toBe(5);
    c.send({ t: 'join', roomId: 'lobby' });
    await c.waitFor('quest', (m) => m.id === 'lobby');
    c.send({ t: 'chat', text: 'hej ida' });
    await c.waitFor('quest', (m) => m.id === 'ida');
    c.ws.close();
  });

  it('gives daily quests once the start quests are done', async () => {
    const { c, g, welcome } = await login('Daglig');
    expect(welcome.me.daily.quests).toHaveLength(3);
    expect(welcome.me.daily.quests[0]!.id).toBe('d_login');
    expect(c.msgs.some((m) => m.t === 'daily')).toBe(false); // not onboarded yet
    app.store.getUser(g.userId)!.quests.push(...QUESTS.map((q) => q.id));
    c.ws.close();
    const c2 = new TestClient();
    await c2.open();
    c2.send({ t: 'auth', token: g.token });
    const d = await c2.waitFor('daily', (m) => m.doneId === 'd_login');
    expect(d.daily.quests[0]!.done).toBe(true);
    c2.ws.close();
  });

  it('sells clothes and only lets you wear what you own', async () => {
    const { c, welcome } = await login('Modeløve');
    expect(welcome.me.wardrobe).toEqual([]);
    c.send({ t: 'look', look: { ...DEFAULT_LOOK, hat: 'cowboy' } });
    expect((await c.waitFor('toast', (m) => /købes/.test(m.text))).kind).toBe('error');
    c.send({ t: 'buyClothes', key: 'hat:cowboy' });
    expect((await c.waitFor('wardrobe')).wardrobe).toContain('hat:cowboy');
    expect((await c.waitFor('coins')).coins).toBe(10);
    c.send({ t: 'look', look: { ...DEFAULT_LOOK, hat: 'cowboy' } });
    expect((await c.waitFor('look')).look.hat).toBe('cowboy');
    c.send({ t: 'buyClothes', key: 'hat:krone' });
    expect((await c.waitFor('toast', (m) => /Kræver/.test(m.text))).kind).toBe('error');
    c.ws.close();
  });

  it('stores furniture in the inventory and trades it safely', async () => {
    const a = await login('Sælger');
    const b = await login('Køber');
    // stash a default item from A's room and place it back
    const first = a.room.room.items.find((i) => i.type === 'plant')!;
    a.c.send({ t: 'stash', id: first.id });
    expect((await a.c.waitFor('inventory')).items).toEqual([{ type: 'plant' }]);
    for (const u of [a, b]) app.store.getUser(u.g.userId)!.quests.push(...QUESTS.map((q) => q.id));
    for (const u of [a, b]) {
      u.c.send({ t: 'join', roomId: 'lobby' });
      await u.c.waitFor('room', (m) => m.room.id === 'lobby');
    }
    a.c.send({ t: 'tradeStart', userId: b.g.userId });
    expect((await b.c.waitFor('tradeAsk')).from.name).toBe('Sælger');
    b.c.send({ t: 'tradeReply', accept: true });
    await a.c.waitFor('trade');
    a.c.send({ t: 'tradeOffer', coins: 0, inv: [0], clothes: [] });
    await b.c.waitFor('trade', (m) => m.trade.theirs.items.length === 1);
    b.c.send({ t: 'tradeOffer', coins: 999, inv: [], clothes: [] });
    expect((await b.c.waitFor('toast', (m) => /mønter/.test(m.text))).kind).toBe('error');
    b.c.send({ t: 'tradeOffer', coins: 10, inv: [], clothes: [] });
    await a.c.waitFor('trade', (m) => m.trade.theirs.coins === 10);
    a.c.send({ t: 'tradeAccept' });
    await b.c.waitFor('trade', (m) => m.trade.theirOk);
    b.c.send({ t: 'tradeAccept' });
    expect((await a.c.waitFor('tradeEnd')).done).toBe(true);
    expect((await b.c.waitFor('inventory')).items).toEqual([{ type: 'plant' }]);
    expect(app.store.getUser(a.g.userId)!.inventory).toEqual([]);
    expect(app.store.getUser(b.g.userId)!.coins).toBe(25); // 30 + 5 (lobby quest) − 10
    a.c.ws.close();
    b.c.ws.close();
  });

  it('plays dice, rock-paper-scissors and quiz with capped coin rewards', async () => {
    const { c } = await login('Spiller');
    c.send({ t: 'join', roomId: 'arcade' });
    await c.waitFor('room', (m) => m.room.id === 'arcade');
    c.send({ t: 'chat', text: '/terning' });
    expect((await c.waitFor('sys')).text).toMatch(/slog en/);
    c.send({ t: 'chat', text: '/ssp sten' });
    expect((await c.waitFor('sys')).text).toMatch(/Spiller mod/);
    c.send({ t: 'chat', text: '/quiz' });
    const q = await c.waitFor('sys', (m) => m.text.startsWith('❓'));
    const quiz = QUIZ_FOR_TEST.find((x) => q.text.includes(x.q))!;
    c.send({ t: 'chat', text: quiz.a[0]! });
    expect((await c.waitFor('sys', (m) => m.text.startsWith('✅'))).text).toMatch(/Spiller/);
    c.ws.close();
  });

  it('announces events to guests', async () => {
    app.hotel.manualEvent = {
      id: 'test',
      name: 'Testfest',
      roomId: 'cafe',
      until: Date.now() + 60_000,
    };
    const { c } = await login('Festgæst');
    const ev = await c.waitFor('events', (m) => m.events.some((e) => e.id === 'test'));
    expect(ev.events.find((e) => e.id === 'test')!.roomId).toBe('cafe');
    app.hotel.manualEvent = null;
    c.ws.close();
  });

  it('lets admins see reports and mute, kick and ban', async () => {
    const boss = await login('Chefen');
    expect(boss.welcome.me.role).toBe('admin');
    const troll = await login('Trold');
    const victim = await login('Offer');
    victim.c.send({ t: 'report', userId: troll.g.userId, reason: 'grimt sprog' });
    await victim.c.waitFor('toast');
    troll.c.send({ t: 'admin', action: 'reports' }); // not allowed
    boss.c.send({ t: 'admin', action: 'reports' });
    const reps = await boss.c.waitFor('adminReports');
    const rep = reps.reports.find((r) => r.target.name === 'Trold')!;
    expect(rep.status).toBe('open');
    expect(troll.c.msgs.some((m) => m.t === 'adminReports')).toBe(false);
    boss.c.send({ t: 'admin', action: 'mute', userId: troll.g.userId, minutes: 10 });
    await troll.c.waitFor('toast', (m) => /pause/.test(m.text));
    troll.c.send({ t: 'chat', text: 'hallo' });
    await troll.c.waitFor('toast', (m) => /pause i chatten/.test(m.text));
    boss.c.send({ t: 'admin', action: 'resolve', reportId: rep.id });
    await boss.c.waitFor(
      'adminReports',
      (m) => m.reports.find((r) => r.id === rep.id)!.status === 'closed',
    );
    boss.c.send({ t: 'admin', action: 'ban', userId: troll.g.userId, minutes: 60 });
    await new Promise<void>((r) => troll.c.ws.once('close', () => r()));
    expect(app.store.getUser(troll.g.userId)!.bannedUntil).toBeGreaterThan(Date.now());
    boss.c.ws.close();
    victim.c.ws.close();
  });

  it('gives admins 100 coins with /penge, but not normal users', async () => {
    const boss = await login('Kassereren');
    const before = app.store.getUser(boss.g.userId)!.coins;
    boss.c.send({ t: 'chat', text: '/penge' });
    await boss.c.waitFor('coins', (m) => m.reason === 'cheat');
    expect(app.store.getUser(boss.g.userId)!.coins).toBe(before + 100);
    const pleb = await login('Almindelig');
    const start = app.store.getUser(pleb.g.userId)!.coins;
    pleb.c.send({ t: 'chat', text: '/penge' });
    await new Promise((r) => setTimeout(r, 200));
    expect(app.store.getUser(pleb.g.userId)!.coins).toBe(start);
    boss.c.ws.close();
    pleb.c.ws.close();
  });

  it('switches lamps, lets you lie in bed and shows a level', async () => {
    const { c, room, g } = await login('Natteravn');
    expect(room.room.players.find((p) => p.id === g.userId)!.level).toBe(1);
    const lamp = room.room.items.find((i) => i.type === 'lamp')!;
    c.send({ t: 'use', itemId: lamp.id });
    expect((await c.waitFor('itemPut', (m) => m.item.id === lamp.id)).item.state).toBe(0);
    c.send({ t: 'use', itemId: lamp.id });
    expect((await c.waitFor('itemPut', (m) => m.item.id === lamp.id)).item.state).toBe(1);
    c.send({ t: 'buy', type: 'bed', x: 5, z: 5, rot: 0 });
    const bed = (await c.waitFor('itemPut', (m) => m.item.type === 'bed')).item;
    c.send({ t: 'sit', itemId: bed.id });
    expect((await c.waitFor('path', (m) => m.id === g.userId)).seatId).toBe(bed.id);
    c.ws.close();
  });

  it('sells extra apartment rooms from a level', async () => {
    const { c, g, welcome } = await login('Lejer');
    expect(welcome.me.apartment.map((r) => r.kind)).toEqual(['living']);
    c.send({ t: 'buyRoom', kind: 'bedroom' });
    expect((await c.waitFor('toast', (m) => /level 3/.test(m.text))).kind).toBe('error');
    const u = app.store.getUser(g.userId)!;
    u.onlineSec = 3 * 3600;
    u.coins = 200;
    c.send({ t: 'buyRoom', kind: 'bedroom' });
    const ap = await c.waitFor('apartment');
    expect(ap.rooms.map((r) => r.kind)).toEqual(['living', 'bedroom']);
    const r = await c.waitFor('room', (m) => m.room.id === ap.rooms[1]!.id);
    expect(r.room.theme).toBe('bedroom');
    expect(r.room.canBuild).toBe(true);
    expect(r.room.items.some((i) => i.type === 'bed')).toBe(true);
    c.ws.close();
  });

  it('puts you back in the same room after a reconnect', async () => {
    const { c, g } = await login('Tilbage');
    c.send({ t: 'join', roomId: 'cafe' });
    await c.waitFor('room', (m) => m.room.id === 'cafe');
    c.ws.close();
    await new Promise((r) => setTimeout(r, 100));
    const c2 = new TestClient();
    await c2.open();
    c2.send({ t: 'auth', token: g.token });
    expect((await c2.waitFor('room')).room.id).toBe('cafe');
    c2.ws.close();
  });

  it('keeps public rooms at most ROOM_CAPACITY guests and makes the café 12×12', async () => {
    const first = await login('Kaffegæst');
    first.c.send({ t: 'join', roomId: 'cafe' });
    const r = await first.c.waitFor('room', (m) => m.room.id === 'cafe');
    expect(r.room.size).toBe(12);
    const cafe = (
      app.hotel as unknown as { rooms: Map<string, { humans(): unknown[] }> }
    ).rooms.get('cafe')!;
    const realHumans = cafe.humans.bind(cafe);
    cafe.humans = () => Array.from({ length: ROOM_CAPACITY }, () => ({}));
    const late = await login('Sentkommer');
    late.c.send({ t: 'join', roomId: 'cafe' });
    expect((await late.c.waitFor('toast', (m) => /fyldt/.test(m.text))).text).toMatch(/Caféen/);
    late.c.send({ t: 'navigator' });
    const nav = await late.c.waitFor('navigator');
    expect(nav.rooms.find((x) => x.id === 'cafe')!.max).toBe(ROOM_CAPACITY);
    cafe.humans = realHumans;
    first.c.ws.close();
    late.c.ws.close();
  });

  it('buys wallpaper and floor once, and hangs pictures on the wall', async () => {
    const { c, g } = await login('Tapetserer');
    const u = app.store.getUser(g.userId)!;
    u.coins = 200;
    c.send({ t: 'decor', kind: 'wall', id: 'mint' });
    const d = await c.waitFor('decor', (m) => m.wall === 'mint');
    expect(d.owned).toContain('wall:mint');
    expect(u.coins).toBe(200 - 15);
    c.send({ t: 'decor', kind: 'wall', id: null });
    await c.waitFor('decor', (m) => m.wall === null);
    c.send({ t: 'decor', kind: 'wall', id: 'mint' }); // already owned: free
    await c.waitFor('decor', (m) => m.wall === 'mint');
    expect(u.coins).toBe(185);
    c.send({ t: 'decor', kind: 'floor', id: 'marmor' }); // needs level 3
    expect((await c.waitFor('toast', (m) => /level 3/.test(m.text))).kind).toBe('error');
    expect(app.store.getRoom(u.homeRoomId)!.wall).toBe('mint');
    c.send({ t: 'buy', type: 'painting', x: 1, z: 0, rot: 0 });
    expect((await c.waitFor('itemPut', (m) => m.item.type === 'painting')).item.x).toBe(1);
    c.send({ t: 'join', roomId: 'cafe' });
    await c.waitFor('room', (m) => m.room.id === 'cafe');
    c.send({ t: 'decor', kind: 'floor', id: 'skak' });
    expect((await c.waitFor('toast', (m) => /egne rum/.test(m.text))).kind).toBe('error');
    c.ws.close();
  });

  it('buys a pet that follows you, eats, learns tricks by level and answers its name', async () => {
    const a = await login('Hundeejer');
    const b = await login('Nabo');
    const u = app.store.getUser(a.g.userId)!;
    u.coins = 100;
    for (const x of [a, b]) {
      x.c.send({ t: 'join', roomId: 'cafe' });
      await x.c.waitFor('room', (m) => m.room.id === 'cafe');
    }
    a.c.send({ t: 'buyPet', kind: 'drage', name: 'Glød', color: 0 }); // needs level 4
    expect((await a.c.waitFor('toast', (m) => /level 4/.test(m.text))).kind).toBe('error');
    a.c.send({ t: 'buyPet', kind: 'hund', name: 'Fido', color: 1 });
    const pets = await a.c.waitFor('pets', (m) => m.pets.length === 1);
    expect(pets.active).toBe(pets.pets[0]!.id);
    expect(u.coins).toBe(60);
    // The neighbour sees the dog appear next to its owner.
    const pv = await b.c.waitFor('petView', (m) => m.ownerId === a.g.userId);
    expect(pv.pet).toMatchObject({ kind: 'hund', name: 'Fido', level: 1 });
    // Level 1 can sit, but not roll yet.
    a.c.send({ t: 'petTrick', trick: 'roll' });
    expect((await a.c.waitFor('toast', (m) => /level 3/.test(m.text))).kind).toBe('error');
    a.c.send({ t: 'petTrick', trick: 'sit' });
    const act = await b.c.waitFor('petAct', (m) => m.act === 'sit');
    expect(act.say).toBeTruthy();
    // Just bought = just fed, so it is full.
    a.c.send({ t: 'petFeed' });
    await a.c.waitFor('toast', (m) => /mæt/.test(m.text));
    u.pets![0]!.lastFed = 0; // starving
    a.c.send({ t: 'petTrick', trick: 'sit' });
    await a.c.waitFor('toast', (m) => /sulten/.test(m.text));
    a.c.send({ t: 'petFeed' });
    await b.c.waitFor('petAct', (m) => m.act === 'eat');
    expect(u.pets![0]!.xp).toBeGreaterThanOrEqual(5);
    expect(u.coins).toBe(58);
    // Saying its name makes it answer.
    a.c.send({ t: 'chat', text: 'Kom her Fido!' });
    await b.c.waitFor('petAct', (m) => m.act === 'happy');
    // Newcomers see the pet in the room view; sending it home removes it.
    const c3 = await login('Senere');
    c3.c.send({ t: 'join', roomId: 'cafe' });
    const rv = await c3.c.waitFor('room', (m) => m.room.id === 'cafe');
    expect(rv.room.players.find((p) => p.id === a.g.userId)!.pet?.name).toBe('Fido');
    a.c.send({ t: 'petOut', id: null });
    expect((await b.c.waitFor('petView', (m) => m.pet === null)).ownerId).toBe(a.g.userId);
    for (const x of [a, b, c3]) x.c.ws.close();
  });

  it('renovates your own room: size costs coins and level, shapes move furniture to the inventory', async () => {
    const { c, g } = await login('Arkitekt');
    const u = app.store.getUser(g.userId)!;
    c.send({ t: 'renovate', size: 10, shape: 'square' });
    expect((await c.waitFor('toast', (m) => /level 3/.test(m.text))).kind).toBe('error');
    u.onlineSec = 3 * 3600;
    u.coins = 100;
    c.send({ t: 'renovate', size: 10, shape: 'L' });
    const r = await c.waitFor('room', (m) => m.room.size === 10);
    expect(r.room.shape).toBe('L');
    expect(u.coins).toBe(20);
    const rec = app.store.getRoom(u.homeRoomId)!;
    expect(rec.paidSize).toBe(10);
    // Down to a small J-shape (free): things in the hole go to the inventory.
    const before = rec.items.length;
    c.send({ t: 'renovate', size: 7, shape: 'J' });
    await c.waitFor('room', (m) => m.room.size === 7 && m.room.shape === 'J');
    expect(u.coins).toBe(20);
    expect(rec.items.length + (u.inventory ?? []).length).toBe(before);
    // Back to 10×10 is free: already paid.
    c.send({ t: 'renovate', size: 10, shape: 'square' });
    await c.waitFor('room', (m) => m.room.size === 10 && m.room.shape === 'square');
    expect(u.coins).toBe(20);
    c.send({ t: 'join', roomId: 'cafe' });
    await c.waitFor('room', (m) => m.room.id === 'cafe');
    c.send({ t: 'renovate', size: 8, shape: 'U' });
    expect((await c.waitFor('toast', (m) => /egne rum/.test(m.text))).kind).toBe('error');
    c.ws.close();
  });

  it('finds rooms by search, category and favourites in the navigator', async () => {
    const owner = await login('Festabe');
    owner.c.send({ t: 'roomSettings', name: 'Diskoteket', category: 'fest' });
    await owner.c.waitFor('roomMeta', (m) => m.category === 'fest');
    const other = await login('Sedelskriver');
    other.c.send({ t: 'navigator', q: 'disko' });
    const res = await other.c.waitFor('navigator', (m) => m.q === 'disko');
    const hit = res.rooms.find((r) => r.name === 'Diskoteket')!;
    expect(hit.category).toBe('fest');
    expect(hit.fav).toBe(false);
    other.c.send({ t: 'navigator', q: 'festabe' }); // the owner's name works too
    expect(
      (await other.c.waitFor('navigator', (m) => m.q === 'festabe')).rooms.some(
        (r) => r.id === hit.id,
      ),
    ).toBe(true);
    other.c.send({ t: 'favorite', roomId: hit.id, on: true });
    const fav = await other.c.waitFor(
      'navigator',
      (m) => m.q === undefined && m.rooms.some((r) => r.id === hit.id),
    );
    expect(fav.rooms.find((r) => r.id === hit.id)!.fav).toBe(true);
    expect(fav.rooms.find((r) => r.id === 'arcade')!.category).toBe('spil');
    owner.c.ws.close();
    other.c.ws.close();
  });

  it('raises tiles into stairs in your own room and blocks climbing two steps at once', async () => {
    const { c, g } = await login('Trappebygger');
    const u = app.store.getUser(g.userId)!;
    c.send({ t: 'setHeight', x: DOOR_TILE_FOR_TEST[0], z: DOOR_TILE_FOR_TEST[1], h: 1 });
    await c.waitFor('toast', (m) => /døren/.test(m.text));
    c.send({ t: 'setHeight', x: 6, z: 6, h: 2 });
    expect((await c.waitFor('heights')).heights['6,6']).toBe(2);
    expect(app.store.getRoom(u.homeRoomId)!.heights!['6,6']).toBe(2);
    c.send({ t: 'move', x: 6, z: 6 }); // two steps up from the floor: no path
    await new Promise((r) => setTimeout(r, 200));
    expect(
      c.msgs.some(
        (m) => m.t === 'path' && m.id === g.userId && m.path.some(([x, z]) => x === 6 && z === 6),
      ),
    ).toBe(false);
    c.send({ t: 'setHeight', x: 6, z: 5, h: 1 });
    await c.waitFor('heights', (m) => m.heights['6,5'] === 1);
    c.send({ t: 'move', x: 6, z: 6 });
    const p = await c.waitFor('path', (m) => m.id === g.userId && m.path.length > 0);
    expect(p.path[p.path.length - 1]).toEqual([6, 6]);
    c.send({ t: 'setHeight', x: 6, z: 6, h: 0 });
    await c.waitFor('heights', (m) => m.heights['6,6'] === undefined);
    c.ws.close();
  });

  it('shows a home page profile with friends, rooms and a guestbook', async () => {
    const a = await login('Profilejer');
    const b = await login('Hilsner');
    b.c.send({ t: 'guestbookWrite', userId: a.g.userId, text: 'Fedt værelse! 👋' });
    const p = await b.c.waitFor('profile', (m) => (m.profile.guestbook ?? []).length === 1);
    expect(p.profile.guestbook![0]!.fromName).toBe('Hilsner');
    expect(p.profile.rooms!.length).toBeGreaterThan(0);
    expect(p.profile.level).toBe(1);
    expect(p.profile.online).toBe(true);
    await a.c.waitFor('toast', (m) => /gæstebog/.test(m.text));
    // The owner may delete it.
    const id = p.profile.guestbook![0]!.id;
    a.c.send({ t: 'guestbookDelete', userId: a.g.userId, id });
    await a.c.waitFor(
      'profile',
      (m) => m.profile.id === a.g.userId && m.profile.guestbook!.length === 0,
    );
    a.c.ws.close();
    b.c.ws.close();
  });

  it('sells and buys on the market, also when the seller is offline', async () => {
    const s1 = await login('Sælgeren');
    const b1 = await login('Køberen');
    const seller = app.store.getUser(s1.g.userId)!;
    const buyer = app.store.getUser(b1.g.userId)!;
    seller.inventory = [{ type: 'lamp' }];
    buyer.coins = 50;
    const sellerCoins = seller.coins;
    s1.c.send({ t: 'marketSell', index: 0, price: 20 });
    const mk = await s1.c.waitFor('market', (m) => m.mine.length === 1);
    expect(seller.inventory).toEqual([]);
    s1.c.ws.close(); // seller goes offline
    await new Promise((r) => setTimeout(r, 100));
    b1.c.send({ t: 'market' });
    const list = await b1.c.waitFor('market', (m) =>
      m.listings.some((l) => l.id === mk.mine[0]!.id),
    );
    expect(list.listings.find((l) => l.id === mk.mine[0]!.id)!.sellerName).toBe('Sælgeren');
    b1.c.send({ t: 'marketBuy', id: mk.mine[0]!.id });
    await b1.c.waitFor('inventory', (m) => m.items.some((i) => i.type === 'lamp'));
    expect(buyer.coins).toBe(30);
    expect(seller.coins).toBe(sellerCoins + 19); // 5 % fee
    // Buying the same listing twice is impossible.
    b1.c.send({ t: 'marketBuy', id: mk.mine[0]!.id });
    await b1.c.waitFor('toast', (m) => /solgt/.test(m.text));
    expect(buyer.coins).toBe(30);
    b1.c.ws.close();
  });

  it('teleports between two rooms with a pair of linked teleporters', async () => {
    const { c, g } = await login('Teleportør');
    const u = app.store.getUser(g.userId)!;
    u.onlineSec = 3600 * 2;
    u.coins = 300;
    c.send({ t: 'buy', type: 'teleport', x: 5, z: 1, rot: 0 });
    const put = await c.waitFor('itemPut', (m) => m.item.type === 'teleport');
    const inv = await c.waitFor('inventory', (m) => m.items.some((i) => i.type === 'teleport'));
    const twin = inv.items.find((i) => i.type === 'teleport')!;
    expect(twin.pair).toBe(put.item.pair);
    // Not placed yet: nothing happens.
    c.send({ t: 'teleport', itemId: put.item.id });
    await c.waitFor('toast', (m) => /ikke stillet op/.test(m.text), 8000);
    c.send({ t: 'buyRoom', kind: 'bedroom' });
    const apt = await c.waitFor('apartment');
    const bedroom = apt.rooms.find((r) => r.kind === 'bedroom')!;
    await c.waitFor('room', (m) => m.room.id === bedroom.id);
    c.send({ t: 'placeInv', index: inv.items.indexOf(twin), x: 2, z: 5, rot: 0 });
    await c.waitFor('itemPut', (m) => m.item.type === 'teleport' && m.item.pair === twin.pair);
    c.send({ t: 'join', roomId: u.homeRoomId });
    await c.waitFor('room', (m) => m.room.id === u.homeRoomId);
    c.msgs.length = 0;
    c.send({ t: 'teleport', itemId: put.item.id });
    const arrived = await c.waitFor('room', (m) => m.room.id === bedroom.id, 8000);
    const me = arrived.room.players.find((p) => p.id === g.userId)!;
    expect(Math.max(Math.abs(me.x - 2), Math.abs(me.z - 5))).toBeLessThanOrEqual(1);
    c.ws.close();
  }, 15_000);

  it('walks between apartment rooms through their doors', async () => {
    const { c, g } = await login('Lejligheden');
    const u = app.store.getUser(g.userId)!;
    u.onlineSec = 3 * 3600;
    u.coins = 200;
    c.send({ t: 'buyRoom', kind: 'bedroom' });
    const bed = await c.waitFor('room', (m) => m.room.theme === 'bedroom');
    const back = bed.room.doors[0]!;
    expect(back.roomId).toBe(u.homeRoomId);
    // Walk into the door back to the living room…
    c.msgs.length = 0;
    c.send({ t: 'aptDoor', index: 0 });
    const living = await c.waitFor('room', (m) => m.room.id === u.homeRoomId, 8000);
    const toBed = living.room.doors.find((d) => d.roomId === bed.room.id)!;
    expect(toBed).toBeTruthy();
    // …and you arrive in front of the door that leads back to the bedroom.
    const me = living.room.players.find((p) => p.id === g.userId)!;
    const [sx, sz] = toBed.wall === 0 ? [toBed.idx, 0] : [0, toBed.idx];
    expect(Math.max(Math.abs(me.x - sx), Math.abs(me.z - sz))).toBeLessThanOrEqual(1);
    c.ws.close();
  }, 15_000);

  it('lists every open room in a category, even with nobody in it', async () => {
    const owner = await login('Butiksejer');
    owner.c.send({ t: 'roomSettings', name: 'Byttebiksen', category: 'handel' });
    await owner.c.waitFor('roomMeta', (m) => m.category === 'handel');
    owner.c.ws.close();
    const v = await login('Kigger');
    v.c.send({ t: 'navigator', cat: 'handel' });
    const res = await v.c.waitFor('navigator', (m) => m.cat === 'handel');
    expect(res.rooms.some((r) => r.name === 'Byttebiksen' && r.users === 0)).toBe(true);
    v.c.ws.close();
  });

  it('plays Farvekamp: two teams paint colour tiles and the bigger team wins', async () => {
    const a = await login('Maleren');
    const b = await login('Pensel');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    // A game console and a row of colour tiles in Maleren's room.
    home.items.push({ id: 9001, type: 'gamebox', x: 7, z: 7, rot: 0 });
    for (let x = 0; x < 6; x++)
      home.items.push({ id: 9010 + x, type: 'colortile', x, z: 6, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    a.c.send({ t: 'gameStart', itemId: 9001, kind: 'paint' });
    const g = await a.c.waitFor('roomGame', (m) => m.game?.phase === 'countdown');
    expect(Object.keys(g.game!.teams!).length).toBe(2);
    const myTeam = g.game!.teams![a.g.userId]!;
    await a.c.waitFor('roomGame', (m) => m.game?.phase === 'play', 6000);
    a.c.send({ t: 'move', x: 5, z: 6 });
    const tile = await b.c.waitFor(
      'itemPut',
      (m) => m.item.type === 'colortile' && m.item.state === myTeam,
      6000,
    );
    expect(tile.item.state).toBe(myTeam);
    // End early for the test: the clock runs out.
    const room = (
      app.hotel as unknown as { rooms: Map<string, { game: { until: number } | null }> }
    ).rooms.get(ua.homeRoomId)!;
    room.game!.until = Date.now();
    const sys = await a.c.waitFor('sys', (m) => /vinder Farvekamp/.test(m.text), 4000);
    expect(sys.text).toContain(myTeam === 1 ? 'Rød' : 'Blå');
    await a.c.waitFor('roomGame', (m) => m.game === null);
    a.c.ws.close();
    b.c.ws.close();
  }, 20_000);

  it('shouts with a cooldown, does :actions and emotes, and uses unlocked bubbles only', async () => {
    const a = await login('Råberen');
    const b = await login('Hører');
    const ua = app.store.getUser(a.g.userId)!;
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    a.c.send({ t: 'chat', text: ':shout Hej allesammen' });
    const sh = await b.c.waitFor('chat', (m) => m.shout === true);
    expect(sh.text).toBe('Hej allesammen');
    a.c.send({ t: 'chat', text: ':shout igen' });
    await a.c.waitFor('toast', (m) => /råbe igen/.test(m.text));
    a.c.send({ t: 'chat', text: ':sit' });
    await b.c.waitFor('action', (m) => m.id === a.g.userId && m.kind === 'sitfloor');
    a.c.send({ t: 'chat', text: ':heart' });
    await b.c.waitFor('emote', (m) => m.id === a.g.userId && m.kind === 'heart');
    a.c.send({ t: 'setBubble', style: 'host' });
    await a.c.waitFor('toast', (m) => /ikke låst op/.test(m.text));
    a.c.send({ t: 'setBubble', style: 'classic' });
    await a.c.waitFor('toast', (m) => /Ny chatboble/.test(m.text));
    a.c.send({ t: 'chat', text: 'hej med dig' });
    const c = await b.c.waitFor('chat', (m) => m.text === 'hej med dig');
    expect(c.style).toBe('classic');
    a.c.ws.close();
    b.c.ws.close();
  });

  it('hides your room from friends with "må ikke følges" and shows relations on the profile', async () => {
    const a = await login('Skjuler');
    const b = await login('Søger');
    const ua = app.store.getUser(a.g.userId)!;
    const ub = app.store.getUser(b.g.userId)!;
    ua.friends.push(ub.id);
    ub.friends.push(ua.id);
    a.c.send({ t: 'setPrivacy', noFollow: true });
    const fr = await b.c.waitFor('friends', (m) =>
      m.friends.some((f) => f.id === ua.id && f.online),
    );
    expect(fr.friends.find((f) => f.id === ua.id)!.roomId).toBeNull();
    b.c.send({ t: 'setRelation', userId: ua.id, kind: 'heart' });
    b.c.send({ t: 'setRelation', userId: 'nobody', kind: 'skull' });
    await b.c.waitFor('toast', (m) => /kun markere dine venner/.test(m.text));
    a.c.send({ t: 'profile', userId: ub.id });
    const prof = await a.c.waitFor('profile');
    expect(prof.profile.relations).toEqual([
      { kind: 'heart', users: [{ id: ua.id, name: 'Skjuler' }] },
    ]);
    a.c.ws.close();
    b.c.ws.close();
  });

  it('lets guests pin post-its that only show once the owner approves them', async () => {
    const a = await login('Tavleejer');
    const b = await login('Postitgæst');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9301, type: 'noteboard', x: 3, z: 0, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    b.c.send({ t: 'noteWrite', text: 'Fedt værelse!', color: 1 });
    const own = await b.c.waitFor('notes', (m) => m.notes.length === 1);
    expect(own.notes[0]!.approved).toBe(false);
    const pending = await a.c.waitFor('notes', (m) => m.canModerate && m.notes.length === 1);
    a.c.send({ t: 'noteApprove', id: pending.notes[0]!.id });
    const ok = await b.c.waitFor('notes', (m) => m.notes[0]?.approved === true);
    expect(ok.notes[0]!.text).toBe('Fedt værelse!');
    a.c.ws.close();
    b.c.ws.close();
  });

  it('saves outfits, locks effects, and fetches and gives away coffee', async () => {
    const a = await login('Kaffehenter');
    const b = await login('Modtageren');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9401, type: 'kaffemaskine', x: 4, z: 4, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    // Outfits
    a.c.send({ t: 'outfitWear', slot: 0 });
    await a.c.waitFor('toast', (m) => /tom/.test(m.text));
    a.c.send({ t: 'outfitSave', slot: 0 });
    await a.c.waitFor('toast', (m) => /Outfit 1 gemt/.test(m.text));
    a.c.send({ t: 'outfitWear', slot: 0 });
    await b.c.waitFor('look', (m) => m.id === ua.id);
    // Effects: glow needs level 4
    a.c.send({ t: 'setEffect', effect: 'glow' });
    await a.c.waitFor('toast', (m) => /ikke låst op/.test(m.text));
    a.c.send({ t: 'setEffect', effect: 'none' });
    await b.c.waitFor('effect', (m) => m.id === ua.id && m.effect === 'none');
    // Coffee: walk to the machine, take a cup, give it to b
    a.c.send({ t: 'dispense', itemId: 9401, kind: 'kaffe' });
    await b.c.waitFor('carry', (m) => m.id === ua.id && m.item === 'kaffe', 8000);
    a.c.send({ t: 'dispense', itemId: 9401, kind: 'is' });
    a.c.send({ t: 'carryGive', userId: b.g.userId });
    await b.c.waitFor('carry', (m) => m.id === b.g.userId && m.item === 'kaffe');
    await b.c.waitFor('toast', (m) => /gav dig/.test(m.text));
    a.c.ws.close();
    b.c.ws.close();
  }, 15_000);

  it('runs the cinema: owner plays free, a queue, skip votes and the public price', async () => {
    const a = await login('Filmejer');
    const b = await login('Filmgæst');
    const ua = app.store.getUser(a.g.userId)!;
    const ub = app.store.getUser(b.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9501, type: 'laerred', x: 2, z: 0, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    // A guest may not choose in someone's own room.
    b.c.send({ t: 'cinemaAdd', itemId: 9501, video: 'dQw4w9WgXcQ' });
    await b.c.waitFor('toast', (m) => /Kun ejeren/.test(m.text));
    // The owner plays one and queues another, for free.
    const coins = ua.coins;
    a.c.send({ t: 'cinemaAdd', itemId: 9501, video: 'dQw4w9WgXcQ' });
    const put = await b.c.waitFor(
      'itemPut',
      (m) => m.item.id === 9501 && m.item.video === 'dQw4w9WgXcQ',
    );
    expect(Math.abs(put.item.videoAt! - Date.now())).toBeLessThan(5000);
    a.c.send({ t: 'cinemaAdd', itemId: 9501, video: 'aaaaaaaaaaa' });
    const v = await b.c.waitFor('cinema', (m) => m.view.queue.length === 1);
    expect(v.view.canManage).toBe(false);
    expect(ua.coins).toBe(coins);
    // Skip: the owner skips at once, and the queued video starts.
    a.c.send({ t: 'cinemaSkip', itemId: 9501 });
    await b.c.waitFor('itemPut', (m) => m.item.id === 9501 && m.item.video === 'aaaaaaaaaaa');
    // Public cinema: anyone may add, for a few coins.
    b.c.send({ t: 'join', roomId: 'cinema' });
    await b.c.waitFor('room', (m) => m.room.id === 'cinema');
    ub.coins = 20;
    b.c.send({ t: 'cinemaAdd', itemId: 6001, video: 'bbbbbbbbbbb' });
    const pub = await b.c.waitFor('cinema', (m) => m.view.itemId === 6001 && !!m.view.now);
    expect(pub.view.price).toBe(5);
    expect(ub.coins).toBe(15);
    a.c.ws.close();
    b.c.ws.close();
  });

  it('plays Sneboldkamp: hits score points, cost snowballs and freeze the target', async () => {
    const a = await login('Snekaster');
    const b = await login('Snemand');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9601, type: 'gamebox', x: 7, z: 7, rot: 0 });
    home.items.push({ id: 9602, type: 'snedrive', x: 6, z: 1, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    a.c.send({ t: 'gameStart', itemId: 9601, kind: 'snow' });
    const g = await a.c.waitFor('roomGame', (m) => m.game?.phase === 'countdown');
    expect(g.game!.teams![a.g.userId]).not.toBe(g.game!.teams![b.g.userId]);
    await a.c.waitFor('roomGame', (m) => m.game?.phase === 'play', 6000);
    const team = g.game!.teams![a.g.userId]!;
    a.c.send({ t: 'snowThrow', targetId: b.g.userId });
    const ball = await b.c.waitFor('snowball', (m) => m.from === a.g.userId);
    expect(ball.hit).toBe(true);
    const after = await b.c.waitFor(
      'roomGame',
      (m) => !!m.game?.score && m.game.score[team - 1] === 1,
    );
    expect(after.game!.ammo![a.g.userId]).toBe(4);
    // The target is frozen and can't throw back right away.
    b.c.send({ t: 'snowThrow', targetId: a.g.userId });
    await b.c.waitFor('toast', (m) => /ramt/.test(m.text));
    a.c.ws.close();
    b.c.ws.close();
  }, 15_000);

  it('plays a jukebox tune for everyone in the room, chosen only by the owner', async () => {
    const a = await login('Dj Ejer');
    const b = await login('Lytter');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9201, type: 'jukebox', x: 6, z: 6, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    // A guest may not pick the music.
    b.c.send({ t: 'jukebox', itemId: 9201, song: 'fredag' });
    await b.c.waitFor('toast', (m) => /ejeren/.test(m.text));
    a.c.send({ t: 'jukebox', itemId: 9201, song: 'fredag' });
    const put = await b.c.waitFor('itemPut', (m) => m.item.id === 9201 && m.item.song === 'fredag');
    expect(put.item.state).toBe(1);
    expect(Math.abs(put.item.songAt! - Date.now())).toBeLessThan(5000);
    // Unknown tunes are rejected by the schema.
    a.c.send({ t: 'jukebox', itemId: 9201, song: 'ukendt' } as never);
    a.c.send({ t: 'jukebox', itemId: 9201, song: null });
    const off = await b.c.waitFor('itemPut', (m) => m.item.id === 9201 && !m.item.song);
    expect(off.item.state).toBe(0);
    a.c.ws.close();
    b.c.ws.close();
  });

  it('plays Kapløb: the first runner on the goal tile wins coins', async () => {
    const a = await login('Løberen');
    const b = await login('Tilskuer');
    const ua = app.store.getUser(a.g.userId)!;
    const home = app.store.getRoom(ua.homeRoomId)!;
    home.items.push({ id: 9101, type: 'gamebox', x: 7, z: 7, rot: 0 });
    home.items.push({ id: 9102, type: 'racestart', x: 6, z: 1, rot: 0 });
    home.items.push({ id: 9103, type: 'racegoal', x: 6, z: 3, rot: 0 });
    b.c.send({ t: 'join', roomId: ua.homeRoomId });
    await b.c.waitFor('room', (m) => m.room.id === ua.homeRoomId);
    a.c.send({ t: 'gameStart', itemId: 9101, kind: 'race' });
    await a.c.waitFor('roomGame', (m) => m.game?.phase === 'play', 6000);
    const coins = ua.coins;
    a.c.send({ t: 'move', x: 6, z: 3 });
    await a.c.waitFor('sys', (m) => /Løberen vinder Kapløb/.test(m.text), 6000);
    expect(ua.coins).toBe(coins + 5);
    a.c.ws.close();
    b.c.ws.close();
  }, 20_000);

  it('whispers only to someone in the same room, hidden from others', async () => {
    const a = await login('Hviskeren');
    const b = await login('Lytteren');
    const c = await login('Tilskueren');
    for (const x of [a, b, c]) {
      x.c.send({ t: 'join', roomId: 'cafe' });
      await x.c.waitFor('room', (m) => m.room.id === 'cafe');
    }
    a.c.send({ t: 'hush', to: b.g.userId, text: 'psst' });
    const got = await b.c.waitFor('hush');
    expect(got.text).toBe('psst');
    expect(got.fromName).toBe('Hviskeren');
    await a.c.waitFor('hush');
    await new Promise((r) => setTimeout(r, 150));
    expect(c.c.msgs.some((m) => m.t === 'hush')).toBe(false);
    c.c.send({ t: 'join', roomId: 'lobby' });
    await c.c.waitFor('room', (m) => m.room.id === 'lobby');
    a.c.send({ t: 'hush', to: c.g.userId, text: 'hallo?' });
    expect((await a.c.waitFor('toast', (m) => /samme rum/.test(m.text))).kind).toBe('error');
    for (const x of [a, b, c]) x.c.ws.close();
  });

  it('keeps messenger messages for offline friends with an unread count', async () => {
    const a = await login('Brevskriver');
    const b = await login('Modtager');
    a.c.send({ t: 'friendRequest', name: 'modtager' });
    await b.c.waitFor('friends', (m) => m.requests.length > 0);
    b.c.send({ t: 'friendRespond', userId: a.g.userId, accept: true });
    await a.c.waitFor('friends', (m) => m.friends.some((f) => f.id === b.g.userId));
    b.c.ws.close();
    await a.c.waitFor('friends', (m) => m.friends.some((f) => f.id === b.g.userId && !f.online));
    a.c.send({ t: 'whisper', to: b.g.userId, text: 'ses i morgen' });
    await a.c.waitFor('whisper');
    // b logs in again and sees one unread message
    const b2 = new TestClient();
    await b2.open();
    b2.send({ t: 'auth', token: b.g.token });
    const fr = await b2.waitFor('friends');
    expect(fr.friends.find((f) => f.id === a.g.userId)!.unread).toBe(1);
    b2.send({ t: 'pmHistory', with: a.g.userId });
    const h = await b2.waitFor('pmHistory');
    expect(h.msgs.map((m) => m.text)).toEqual(['ses i morgen']);
    const after = await b2.waitFor('friends', (m) =>
      m.friends.some((f) => f.id === a.g.userId && f.unread === 0),
    );
    expect(after).toBeTruthy();
    a.c.ws.close();
    b2.ws.close();
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

describe('delete account', () => {
  it('needs the name typed, then deletes everything and closes the connection', async () => {
    const { c, g, welcome } = await login('Sletmig');
    c.send({ t: 'deleteAccount', confirm: 'forkert' });
    await c.waitFor('toast', (m) => m.kind === 'error');
    expect(app.store.getUser(g.userId)).toBeDefined();
    const closed = new Promise<number>((r) => c.ws.once('close', (code) => r(code)));
    c.send({ t: 'deleteAccount', confirm: welcome.me.name });
    expect(await closed).toBe(4009);
    expect(app.store.getUser(g.userId)).toBeUndefined();
    expect(app.store.getUserByToken(g.token)).toBeUndefined();
    expect(app.store.listRooms().some((r) => r.ownerId === g.userId)).toBe(false);
  });
});

describe('admin user list', () => {
  it('shows admins the newest users, and nobody else', async () => {
    // "Chefen" was created by an earlier test: log in again with the password.
    const res = (await (
      await fetch(`http://${base}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Chefen', password: 'hemmelig123' }),
      })
    ).json()) as { token: string };
    const boss = { c: new TestClient() };
    await boss.c.open();
    boss.c.send({ t: 'auth', token: res.token });
    await boss.c.waitFor('welcome');
    const guest = await login('Nygaest');
    boss.c.send({ t: 'admin', action: 'users' });
    const list = await boss.c.waitFor('adminUsers');
    expect(list.users[0]!.name).toBe('Nygaest');
    expect(list.stats.today).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(list)).not.toContain('passwordHash');
    guest.c.send({ t: 'admin', action: 'users' });
    await new Promise((r) => setTimeout(r, 200));
    expect(guest.c.msgs.some((m) => m.t === 'adminUsers')).toBe(false);
    boss.c.ws.close();
    guest.c.ws.close();
  });
});

describe('golden chest', () => {
  it('an admin can hide one; the first guest to reach it gets a rare', async () => {
    const res = (await (
      await fetch(`http://${base}/api/login`, {
        method: 'POST',
        body: JSON.stringify({ name: 'Chefen', password: 'hemmelig123' }),
      })
    ).json()) as { token: string };
    const boss = new TestClient();
    await boss.open();
    boss.send({ t: 'auth', token: res.token });
    await boss.waitFor('welcome');
    await boss.waitFor('room');
    boss.send({ t: 'join', roomId: 'cafe' });
    await boss.waitFor('room', (m) => m.room.id === 'cafe');
    const finder = await login('Skattejaeger');
    finder.c.send({ t: 'join', roomId: 'cafe' });
    await finder.c.waitFor('room', (m) => m.room.id === 'cafe');
    boss.send({ t: 'admin', action: 'chestSpawn' });
    const shown = await finder.c.waitFor('chest', (m) => !!m.chest);
    finder.c.send({ t: 'chestOpen', id: shown.chest!.id });
    const inv = await finder.c.waitFor(
      'inventory',
      (m) => m.items.some((i) => furniture(i.type).rare),
      8000,
    );
    expect(inv.items.some((i) => furniture(i.type).rare)).toBe(true);
    await finder.c.waitFor('chest', (m) => m.chest === null);
    boss.ws.close();
    finder.c.ws.close();
  }, 15000);
});

describe('limited editions', () => {
  it('sells numbered copies until they run out; numbers follow the item', async () => {
    const a = await login('Samler1');
    const b = await login('Samler2');
    const c3 = await login('Samler3');
    for (const p of [a, b, c3]) app.store.getUser(p.g.userId)!.coins = 1000;
    a.c.send({ t: 'buy', type: 'nordlyslampe', x: 6, z: 6, rot: 0 });
    const putA = await a.c.waitFor('itemPut', (m) => m.item.type === 'nordlyslampe');
    expect(putA.item.serial).toBe(1);
    const lim = await b.c.waitFor('limited', (m) => m.drops[0]?.sold === 1);
    expect(lim.drops[0]!.total).toBe(2);
    b.c.send({ t: 'buy', type: 'nordlyslampe', x: 6, z: 6, rot: 0 });
    expect((await b.c.waitFor('itemPut', (m) => m.item.type === 'nordlyslampe')).item.serial).toBe(
      2,
    );
    c3.c.send({ t: 'buy', type: 'nordlyslampe', x: 6, z: 6, rot: 0 });
    expect((await c3.c.waitFor('toast', (m) => /udsolgt/.test(m.text))).kind).toBe('error');
    // Stash and sell on the market: the number goes along.
    a.c.send({ t: 'stash', id: putA.item.id });
    const inv = await a.c.waitFor('inventory', (m) =>
      m.items.some((i) => i.type === 'nordlyslampe'),
    );
    const idx = inv.items.findIndex((i) => i.type === 'nordlyslampe');
    expect(inv.items[idx]!.serial).toBe(1);
    a.c.send({ t: 'marketSell', index: idx, price: 500 });
    const mk = await a.c.waitFor('market', (m) => m.mine.length > 0);
    expect(mk.mine[0]!.item.serial).toBe(1);
    c3.c.send({ t: 'marketBuy', id: mk.mine[0]!.id });
    const got = await c3.c.waitFor('inventory', (m) =>
      m.items.some((i) => i.type === 'nordlyslampe'),
    );
    expect(got.items.find((i) => i.type === 'nordlyslampe')!.serial).toBe(1);
    for (const p of [a, b, c3]) p.c.ws.close();
  });
});
