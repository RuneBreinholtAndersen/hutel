import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import {
  DEFAULT_HOME_ITEMS,
  isValidName,
  LookSchema,
  ROOM_SIZE,
  type PlacedItem,
} from '@hutel/shared';
import { z } from 'zod';
import { Hotel, type HotelConfig } from './hotel';
import { KeyedLimiter } from './ratelimit';
import { JsonFileStore, verifyPassword, type Store } from './store';

export const VERSION = '0.1.0';

export interface AppConfig extends HotelConfig {
  clientOrigins: string[];
  dataFile: string | null;
  /** Folder with the built client to serve (optional, for single-server deploys). */
  clientDist: string | null;
  /** Guest sign-ups allowed per IP per hour. */
  signupsPerHour?: number;
  /** If set, a code from this list is needed to create an account (closed beta). */
  inviteCodes?: string[];
  /** Supabase project URL + public anon key – enables e-mail/Google/Facebook login. */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Social providers shown on the login page (e.g. ['google']). E-mail link is always on. */
  authProviders?: string[];
  /** Verifies a Supabase access token. Injectable for tests; defaults to Supabase's /auth/v1/user. */
  verifyAuthToken?: (accessToken: string) => Promise<AuthIdentity | null>;
}

export interface AuthIdentity {
  id: string;
  email?: string;
}

/** Ask Supabase who owns this access token. Returns null if the token is invalid. */
export function supabaseVerifier(url: string, anonKey: string) {
  const cache = new Map<string, { id: AuthIdentity; until: number }>();
  return async (accessToken: string): Promise<AuthIdentity | null> => {
    const hit = cache.get(accessToken);
    if (hit && hit.until > Date.now()) return hit.id;
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: anonKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const u = (await r.json()) as { id?: unknown; email?: unknown };
      if (typeof u.id !== 'string') return null;
      const id = { id: u.id, email: typeof u.email === 'string' ? u.email : undefined };
      if (cache.size > 500) cache.clear();
      cache.set(accessToken, { id, until: Date.now() + 60_000 });
      return id;
    } catch {
      return null;
    }
  };
}

const GuestSchema = z.object({
  name: z.string().min(2).max(16),
  look: LookSchema,
  password: z.string().min(8).max(72),
  invite: z.string().max(40).optional(),
  adult: z.literal(true),
  terms: z.literal(true),
});

const ProfileSchema = z.object({
  name: z.string().min(2).max(16),
  /** Optional: password of an existing name+password account to link instead of creating one. */
  password: z.string().min(1).max(72).optional(),
  look: LookSchema,
  invite: z.string().max(40).optional(),
  adult: z.literal(true),
  terms: z.literal(true),
});

const SessionSchema = z.object({
  accessToken: z.string().min(10).max(4096),
  profile: ProfileSchema.optional(),
});

const RESERVED = ['ida', 'magnus', 'luna', 'oskar', 'admin', 'moderator', 'hutel'];

const LoginSchema = z.object({
  name: z.string().min(2).max(16),
  password: z.string().min(1).max(72),
});

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function readBody(req: IncomingMessage, max = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function newHomeItems(): PlacedItem[] {
  return DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 }));
}

export function createApp(
  cfg: AppConfig,
  store: Store = new JsonFileStore(cfg.dataFile, newHomeItems),
) {
  const hotel = new Hotel(store, cfg);
  const perHour = cfg.signupsPerHour ?? 5;
  const signupLimiter = new KeyedLimiter(perHour, perHour / 3600);
  const loginLimiter = new KeyedLimiter(10, 10 / 900);
  const invites = (cfg.inviteCodes ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  const verify =
    cfg.verifyAuthToken ??
    (cfg.supabaseUrl && cfg.supabaseAnonKey
      ? supabaseVerifier(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null);
  const clientIp = (req: IncomingMessage) =>
    (req.headers['fly-client-ip'] as string) ?? req.socket.remoteAddress ?? 'unknown';
  /** Returns [status, message] if the profile can't be used, otherwise null. */
  const checkProfile = (p: { name: string; invite?: string }): [number, string] | null => {
    if (invites.length && !invites.includes((p.invite ?? '').trim().toLowerCase()))
      return [403, 'Hutel er i lukket beta – du skal bruge en gyldig invitationskode.'];
    const name = p.name.trim();
    if (!isValidName(name))
      return [400, 'Navnet må kun have bogstaver, tal, mellemrum, - og _ (2–16 tegn).'];
    if (store.getUserByName(name) || RESERVED.includes(name.toLowerCase()))
      return [409, 'Navnet er taget – prøv et andet.'];
    return null;
  };
  const allowed = (origin: string | undefined) =>
    !origin ||
    cfg.clientOrigins.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  const server: Server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && allowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'content-type');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const url = new URL(req.url ?? '/', 'http://x');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'hutel-server',
        version: VERSION,
        roomSize: ROOM_SIZE,
        ai: hotel.aiEnabled,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/guest') {
      const ip = clientIp(req);
      if (!signupLimiter.take(ip)) return json(res, 429, { ok: false, error: 'Prøv igen senere.' });
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { ok: false, error: 'Ugyldig forespørgsel.' });
      }
      const parsed = GuestSchema.safeParse(body);
      if (!parsed.success)
        return json(res, 400, {
          ok: false,
          error: 'Udfyld navn, en adgangskode på mindst 8 tegn, og bekræft 18+ og vilkår.',
        });
      const bad = checkProfile(parsed.data);
      if (bad) return json(res, bad[0], { ok: false, error: bad[1] });
      const name = parsed.data.name.trim();
      const { user, token } = store.createUser(name, parsed.data.look, {
        password: parsed.data.password,
      });
      return json(res, 200, { ok: true, token, userId: user.id });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, {
        ok: true,
        auth: verify ? 'supabase' : 'password',
        supabaseUrl: cfg.supabaseUrl ?? null,
        supabaseAnonKey: cfg.supabaseAnonKey ?? null,
        inviteRequired: invites.length > 0,
        providers: verify ? (cfg.authProviders ?? ['google']) : [],
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/session') {
      if (!verify) return json(res, 404, { ok: false, error: 'not_found' });
      const ip = clientIp(req);
      if (!loginLimiter.take(`session:${ip}`))
        return json(res, 429, { ok: false, error: 'For mange forsøg – vent lidt og prøv igen.' });
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req, 8192));
      } catch {
        return json(res, 400, { ok: false, error: 'Ugyldig forespørgsel.' });
      }
      const parsed = SessionSchema.safeParse(body);
      if (!parsed.success)
        return json(res, 400, {
          ok: false,
          error: 'Udfyld navn, og bekræft at du er 18+ og accepterer vilkårene.',
        });
      const who = await verify(parsed.data.accessToken);
      if (!who) return json(res, 401, { ok: false, error: 'Login udløbet – prøv igen.' });
      const existing = store.getUserByAuthId(who.id);
      if (existing) {
        if (existing.bannedUntil && existing.bannedUntil > Date.now())
          return json(res, 403, { ok: false, error: 'Kontoen er midlertidigt udelukket.' });
        return json(res, 200, {
          ok: true,
          token: store.rotateToken(existing),
          userId: existing.id,
        });
      }
      const profile = parsed.data.profile;
      if (!profile) return json(res, 200, { ok: true, needsProfile: true });
      const old = profile.password ? store.getUserByName(profile.name.trim()) : undefined;
      if (old && profile.password) {
        const key = `${ip}:${old.name.toLowerCase()}`;
        if (!loginLimiter.take(key))
          return json(res, 429, { ok: false, error: 'For mange forsøg – vent et kvarter.' });
        if (old.authId || !verifyPassword(profile.password, old.passwordHash))
          return json(res, 401, { ok: false, error: 'Forkert adgangskode til den konto.' });
        old.authId = who.id;
        store.touch();
        return json(res, 200, { ok: true, token: store.rotateToken(old), userId: old.id });
      }
      if (!signupLimiter.take(ip)) return json(res, 429, { ok: false, error: 'Prøv igen senere.' });
      const bad = checkProfile(profile);
      if (bad) return json(res, bad[0], { ok: false, error: bad[1] });
      const { user, token } = store.createUser(profile.name.trim(), profile.look, {
        authId: who.id,
      });
      return json(res, 200, { ok: true, token, userId: user.id });
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const ip = clientIp(req);
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { ok: false, error: 'Ugyldig forespørgsel.' });
      }
      const parsed = LoginSchema.safeParse(body);
      if (!parsed.success)
        return json(res, 400, { ok: false, error: 'Skriv dit navn og din adgangskode.' });
      const key = `${ip}:${parsed.data.name.toLowerCase()}`;
      if (!loginLimiter.take(key))
        return json(res, 429, {
          ok: false,
          error: 'For mange forsøg – vent et kvarter og prøv igen.',
        });
      const user = store.getUserByName(parsed.data.name.trim());
      if (!user || !verifyPassword(parsed.data.password, user.passwordHash))
        return json(res, 401, { ok: false, error: 'Forkert navn eller adgangskode.' });
      if (user.bannedUntil && user.bannedUntil > Date.now())
        return json(res, 403, { ok: false, error: 'Kontoen er midlertidigt udelukket.' });
      return json(res, 200, { ok: true, token: store.rotateToken(user), userId: user.id });
    }
    if (cfg.clientDist && req.method === 'GET') {
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(cfg.clientDist, rel);
      if (!file.startsWith(cfg.clientDist) || !existsSync(file) || statSync(file).isDirectory())
        file = join(cfg.clientDist, 'index.html');
      if (existsSync(file)) {
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
        return res.end(readFileSync(file));
      }
    }
    json(res, 404, { ok: false, error: 'not_found' });
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const origin = req.headers.origin;
    let sameOrigin = false;
    try {
      sameOrigin = !!origin && new URL(origin).host === req.headers.host;
    } catch {
      sameOrigin = false;
    }
    if (url.pathname !== '/ws' || !(sameOrigin || allowed(origin))) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const conn = hotel.open({
        send: (d) => ws.readyState === ws.OPEN && ws.send(d),
        close: (code, reason) => ws.close(code, reason),
      });
      let alive = true;
      ws.on('pong', () => (alive = true));
      const hb = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false;
        ws.ping();
      }, 20_000);
      ws.on('message', (data, isBinary) => {
        if (!isBinary) conn.message(data.toString());
      });
      ws.on('close', () => {
        clearInterval(hb);
        conn.close();
      });
    });
  });

  return {
    server,
    hotel,
    store,
    close: () =>
      new Promise<void>((r) => {
        hotel.stop();
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => r());
      }),
  };
}
