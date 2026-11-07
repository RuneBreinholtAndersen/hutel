import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import {
  DEFAULT_LOOK,
  isFriendCode,
  isJuniorName,
  isJuniorPhrase,
  JUNIOR_PHRASES,
  randomJuniorName,
  type ServerMsg,
} from '@hutel/shared';
import { createApp } from './app';

const app = createApp({
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
  junior: true,
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

async function child() {
  const name = freshName();
  const g = await signup({ name });
  expect(g.ok).toBe(true);
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
