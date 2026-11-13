import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import {
  DEFAULT_LOOK,
  isFriendCode,
  isJuniorName,
  isJuniorPhrase,
  JUNIOR_PHRASES,
  LookSchema,
  PALETTE,
  randomJuniorName,
  type ServerMsg,
} from '@hutel/shared';
import { createApp } from './app';

const STAFF_KEY = 'k'.repeat(40);
const mails: { to: string; text: string }[] = [];
const app = createApp({
  sendMail: async (m) => {
    mails.push(m);
  },
  allowReset: false,
  adminNames: [],
  clientOrigins: ['http://localhost:5173'],
  dataFile: null,
  clientDist: null,
  onboardingLock: false,
  botModel: 'test',
  botMaxCallsPerDay: 0,
  signupsPerHour: 1000,
  videoTitles: false,
  chests: false,
  junior: true,
  staffApiKey: STAFF_KEY,
});
let base = '';
beforeAll(async () => {
  await new Promise<void>((r) => app.server.listen(0, r));
  base = `127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
afterAll(() => app.close());

const used = new Set<string>();
function freshName() {
  let n = randomJuniorName();
  while (used.has(n)) n = randomJuniorName();
  used.add(n);
  return n;
}

async function signup(body: Record<string, unknown>) {
  const res = await fetch(`http://${base}/api/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      look: DEFAULT_LOOK,
      password: 'hemmelig123',
      parentEmail: 'mor@example.com',
      parentConsent: true,
      terms: true,
      ...body,
    }),
  });
  return {
    status: res.status,
    ...((await res.json()) as { ok: boolean; token: string; error?: string }),
  };
}

class Client {
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

/** The secret from the newest mail to the parent. */
const lastSecret = () => /[?&]t=([\w-]+)/.exec(mails.at(-1)!.text)![1]!;
async function parentAnswers(secret: string, svar: 'ja' | 'nej') {
  const res = await fetch(`http://${base}/foraelder`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t: secret, svar }).toString(),
  });
  return { status: res.status, html: await res.text() };
}

async function child() {
  const name = freshName();
  const g = await signup({ name });
  expect(g.ok).toBe(true);
  expect((await parentAnswers(lastSecret(), 'ja')).status).toBe(200);
  const c = new Client();
  await c.open();
  c.send({ t: 'auth', token: g.token });
  await c.waitFor('welcome');
  const room = await c.waitFor('room');
  return { c, name, room };
}

describe('junior rules (shared)', () => {
  it('knows its phrases, names and codes', () => {
    const line = JUNIOR_PHRASES.hilsner!.lines[0]!;
    expect(isJuniorPhrase(line)).toBe(true);
    expect(isJuniorPhrase('min adresse er')).toBe(false);
    for (let i = 0; i < 50; i++) expect(isJuniorName(randomJuniorName())).toBe(true);
    expect(isJuniorName('Emma 10')).toBe(false);
    expect(isFriendCode('ABC234')).toBe(true);
    expect(isFriendCode('ABC10O')).toBe(false);
  });
});

describe('Lobbi Junior server', () => {
  it('tells the client it is the junior edition and offers no social login', async () => {
    const r = (await (await fetch(`http://${base}/api/config`)).json()) as {
      edition: string;
      auth: string;
    };
    expect(r.edition).toBe('junior');
    expect(r.auth).toBe('password');
  });

  it('needs a made-up name and a parent', async () => {
    expect((await signup({ name: 'Emma Hansen' })).ok).toBe(false);
    expect((await signup({ name: freshName(), parentConsent: false })).ok).toBe(false);
    expect((await signup({ name: freshName(), parentEmail: 'ikke-en-mail' })).ok).toBe(false);
    expect((await signup({ name: freshName(), adult: true })).ok).toBe(true);
  });

  it('waits for the parent before the child can play', async () => {
    const name = freshName();
    const g = await signup({ name, parentEmail: 'far@example.com' });
    expect(g.ok).toBe(true);
    const mail = mails.at(-1)!;
    expect(mail.to).toBe('far@example.com');
    expect(mail.text).toContain(name);
    const secret = lastSecret();
    // Before the parent answers, the game connection is refused.
    const c = new Client();
    await c.open();
    const closed = new Promise<number>((r) => c.ws.once('close', (code) => r(code)));
    c.send({ t: 'auth', token: g.token });
    expect(await closed).toBe(4005);
    // The page shows the child's name; resending too soon is refused.
    const page = await (await fetch(`http://${base}/foraelder?t=${secret}`)).text();
    expect(page).toContain(name);
    const again = await fetch(`http://${base}/api/parent/resend`, {
      method: 'POST',
      body: JSON.stringify({ token: g.token }),
    });
    expect(again.status).toBe(429);
    expect((await parentAnswers(secret, 'ja')).html).toContain('Tak');
    // The link only works once.
    expect((await parentAnswers(secret, 'ja')).status).toBe(404);
    const c2 = new Client();
    await c2.open();
    c2.send({ t: 'auth', token: g.token });
    await c2.waitFor('welcome');
    c2.ws.close();
  });

  it('deletes the account when the parent says no', async () => {
    const name = freshName();
    const g = await signup({ name });
    expect((await parentAnswers(lastSecret(), 'nej')).html).toContain('slettet');
    expect(app.store.getUserByName(name)).toBeUndefined();
    expect(app.store.getUserByToken(g.token)).toBeUndefined();
  });

  it('only lets ready-made sentences through', async () => {
    const a = await child();
    const b = await child();
    const phrase = JUNIOR_PHRASES.leg!.lines[0]!;
    // Both in the lobby? Put b where a is.
    b.c.send({ t: 'join', roomId: a.room.room.id });
    await b.c.waitFor('room');
    a.c.send({ t: 'chat', text: 'hvor bor du?' });
    await a.c.waitFor('toast', (m) => m.kind === 'error');
    a.c.send({ t: 'chat', text: '/hemmelig' });
    await a.c.waitFor('toast', (m) => m.kind === 'error');
    a.c.send({ t: 'chat', text: phrase });
    const got = await b.c.waitFor('chat', (m) => m.name === a.name);
    expect(got.text).toBe(phrase);
    expect(b.c.msgs.some((m) => m.t === 'chat' && m.text === 'hvor bor du?')).toBe(false);
    a.c.ws.close();
    b.c.ws.close();
  });

  it('never gives a child a beard', async () => {
    const a = await child();
    a.c.send({ t: 'look', look: { ...DEFAULT_LOOK, beard: 'fuld' } });
    const m = await a.c.waitFor('look');
    expect(m.look.beard).toBe('ingen');
    a.c.ws.close();
  });

  it('blocks free-text mottos', async () => {
    const a = await child();
    a.c.send({ t: 'motto', motto: 'ring på 12345678' });
    await a.c.waitFor('toast', (m) => m.kind === 'error');
    a.c.ws.close();
  });

  it('makes friends only with a friend code', async () => {
    const a = await child();
    const b = await child();
    const fa = await a.c.waitFor('friends');
    expect(fa.code && isFriendCode(fa.code)).toBe(true);
    // Searching by name does nothing.
    b.c.send({ t: 'friendRequest', name: a.name.slice(0, 16) });
    await b.c.waitFor('toast', (m) => m.kind === 'error');
    b.c.send({ t: 'friendRequest', name: fa.code });
    const req = await a.c.waitFor('friends', (m) => m.requests.length > 0);
    expect(req.requests[0]!.name).toBe(b.name);
    a.c.ws.close();
    b.c.ws.close();
  });
});

describe('Lobbi-vagt: adult admins in Junior', () => {
  const staffGet = (path: string, key?: string, method = 'GET') =>
    fetch(`http://${base}/api/staff/${path}`, {
      method,
      headers: key ? { authorization: `Bearer ${key}` } : {},
    });

  it('only answers with the shared key', async () => {
    expect((await staffGet('overview')).status).toBe(401);
    expect((await staffGet('overview', 'forkert'.repeat(6))).status).toBe(401);
    const kid = await signup({ name: freshName() });
    expect(kid.ok).toBe(true);
    const o = (await (await staffGet('overview', STAFF_KEY)).json()) as {
      stats: { total: number; waitingParent: number };
      users: { name: string; waiting: boolean }[];
    };
    expect(o.stats.total).toBeGreaterThan(0);
    expect(o.stats.waitingParent).toBeGreaterThan(0);
    expect(o.users[0]!.waiting).toBe(true);
    expect(JSON.stringify(o)).not.toContain('mor@example.com');
  });

  it('logs in as Lobbi-vagt with a one-time link, marked and unable to befriend children', async () => {
    const { url } = (await (await staffGet('login', STAFF_KEY, 'POST')).json()) as { url: string };
    const code = new URL(url).searchParams.get('staff')!;
    const redeem = (c: string) =>
      fetch(`http://${base}/api/staff/redeem`, {
        method: 'POST',
        body: JSON.stringify({ code: c }),
      });
    const r = (await (await redeem(code)).json()) as { ok: boolean; token: string };
    expect(r.ok).toBe(true);
    expect((await redeem(code)).status).toBe(403); // one time only
    const vagt = new Client();
    await vagt.open();
    vagt.send({ t: 'auth', token: r.token });
    const w = await vagt.waitFor('welcome');
    expect(w.me.name).toContain('Lobbi-vagt');
    expect(w.me.role).toBe('admin');
    // The vagt can change clothes like everyone else (its look must pass the schema).
    expect(LookSchema.safeParse(w.me.look).success).toBe(true);
    await vagt.waitFor('room');
    vagt.send({ t: 'look', look: { ...w.me.look, shirt: PALETTE.shirt[2] } });
    await vagt.waitFor('look', (m) => m.look.shirt === PALETTE.shirt[2]);
    const kid = await child();
    kid.c.send({ t: 'look', look: { ...DEFAULT_LOOK, hair: PALETTE.hair[3], hairStyle: 'langt' } });
    await kid.c.waitFor('look', (m) => m.look.hairStyle === 'langt');
    kid.c.send({ t: 'friendRequest', name: (await vagt.waitFor('friends')).code! });
    await kid.c.waitFor('toast', (m) => /Lobbi-vagten/.test(m.text));
    vagt.send({ t: 'friendRequest', name: (await kid.c.waitFor('friends')).code! });
    await vagt.waitFor('toast', (m) => /Lobbi-vagten kan ikke/.test(m.text));
    // The staff account never shows up in the numbers.
    const o = (await (await staffGet('overview', STAFF_KEY)).json()) as {
      users: { name: string }[];
    };
    expect(o.users.some((u) => u.name.includes('Lobbi-vagt'))).toBe(false);
    vagt.ws.close();
    kid.c.ws.close();
  });

  it('is reachable from the adult admin panel', async () => {
    const adult = createApp({
      adminNames: ['voksenchef'],
      clientOrigins: ['http://localhost:5173'],
      dataFile: null,
      clientDist: null,
      onboardingLock: false,
      botModel: 'test',
      botMaxCallsPerDay: 0,
      chests: false,
      juniorApi: { url: `http://${base}`, key: STAFF_KEY },
    });
    await new Promise<void>((r) => adult.server.listen(0, r));
    const ab = `127.0.0.1:${(adult.server.address() as AddressInfo).port}`;
    const g = (await (
      await fetch(`http://${ab}/api/guest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Voksenchef',
          look: DEFAULT_LOOK,
          password: 'hemmelig123',
          adult: true,
          terms: true,
        }),
      })
    ).json()) as { token: string };
    const ws = new WebSocket(`ws://${ab}/ws`, { headers: { origin: 'http://localhost:5173' } });
    const got: ServerMsg[] = [];
    ws.on('message', (d) => got.push(JSON.parse(d.toString()) as ServerMsg));
    await new Promise((r) => ws.once('open', r));
    ws.send(JSON.stringify({ t: 'auth', token: g.token }));
    const wait = async (t: string) => {
      for (let i = 0; i < 100; i++) {
        const m = got.find((x) => x.t === t);
        if (m) return m;
        await new Promise((r) => setTimeout(r, 30));
      }
      throw new Error(`no ${t}`);
    };
    await wait('welcome');
    ws.send(JSON.stringify({ t: 'admin', action: 'junior' }));
    const j = (await wait('adminJunior')) as Extract<ServerMsg, { t: 'adminJunior' }>;
    expect(j.overview?.stats.total).toBeGreaterThan(0);
    ws.send(JSON.stringify({ t: 'admin', action: 'juniorOpen' }));
    const link = (await wait('adminJuniorLink')) as Extract<ServerMsg, { t: 'adminJuniorLink' }>;
    expect(link.url).toContain('?staff=');
    ws.close();
    await adult.close();
  });
});
