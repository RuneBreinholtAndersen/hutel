import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocketServer } from 'ws';
import {
  DEFAULT_HOME_ITEMS,
  isJuniorName,
  isValidName,
  lookAllowed,
  LookSchema,
  type Look,
  ROOM_SIZE,
  type PlacedItem,
} from '@hutel/shared';
import { z } from 'zod';
import { Hotel, type HotelConfig } from './hotel';
import { KeyedLimiter } from './ratelimit';
import { randomBytes } from 'node:crypto';
import { smtpMailer, type SendMail } from './mailer';
import { hashSecret, JsonFileStore, verifyPassword, type Store, type UserRecord } from './store';

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
  /** The game's real address (e.g. https://spil.lobbi.dk). Old addresses send players there. */
  canonicalUrl?: string;
  /** Owner-approved claims: old name+password account name → e-mail allowed to take it over. */
  claimNames?: Record<string, string>;
  /** Verifies a Supabase access token. Injectable for tests; defaults to Supabase's /auth/v1/user. */
  verifyAuthToken?: (accessToken: string) => Promise<AuthIdentity | null>;
  /** Sends e-mail (Junior parent confirmation). Defaults to SMTP from the environment. */
  sendMail?: SendMail;
}

/** Junior accounts a parent never confirmed are deleted after this long. */
const PARENT_WAIT_MS = 7 * 24 * 3600_000;
const PARENT_RESEND_MS = 10 * 60_000;

const escHtml = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function parentPage(title: string, body: string) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)} · Lobbi Junior</title><style>body{font-family:system-ui,sans-serif;background:#2a1a10;color:#3a2210;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{background:#fff6e6;border-radius:18px;max-width:520px;padding:28px;line-height:1.5}h1{margin-top:0}button{font:inherit;border:0;border-radius:10px;padding:10px 16px;margin:6px 6px 0 0;cursor:pointer}.yes{background:#ffb347;font-weight:700}.no{background:#e9dccb}small{color:#7a5a40}</style></head><body><main>${body}</main></body></html>`;
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

/** Lobbi Junior signup: a made-up name, and a parent who says yes (no 18+ box). */
const JuniorGuestSchema = z.object({
  name: z.string().min(2).max(24),
  look: LookSchema,
  password: z.string().min(8).max(72),
  invite: z.string().max(40).optional(),
  parentEmail: z.string().email().max(120),
  parentConsent: z.literal(true),
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

/** New accounts start without paid clothes. */
const freeLook = (look: Look): Look =>
  lookAllowed(look, []) ? look : { ...look, top: undefined, hat: undefined };

export function newHomeItems(): PlacedItem[] {
  return DEFAULT_HOME_ITEMS.map((it, i) => ({ ...it, id: i + 1 }));
}

export function createApp(
  cfg: AppConfig,
  store: Store = new JsonFileStore(cfg.dataFile, newHomeItems),
) {
  let clientBuild: string | undefined;
  try {
    if (cfg.clientDist)
      clientBuild = (
        JSON.parse(readFileSync(join(cfg.clientDist, 'version.json'), 'utf8')) as { build?: string }
      ).build;
  } catch {
    /* dev build without version.json */
  }
  const hotel = new Hotel(store, { ...cfg, clientBuild });
  const perHour = cfg.signupsPerHour ?? 5;
  const signupLimiter = new KeyedLimiter(perHour, perHour / 3600);
  const loginLimiter = new KeyedLimiter(10, 10 / 900);
  const sessionLimiter = new KeyedLimiter(30, 30 / 900);
  const invites = (cfg.inviteCodes ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  const verify =
    cfg.verifyAuthToken ??
    (cfg.supabaseUrl && cfg.supabaseAnonKey
      ? supabaseVerifier(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null);
  const clientIp = (req: IncomingMessage) =>
    (req.headers['fly-client-ip'] as string) ?? req.socket.remoteAddress ?? 'unknown';
  const sendMail = cfg.sendMail ?? smtpMailer();
  /** Where links in e-mails point: the configured address, else the host the request came to. */
  const publicBase = (req: IncomingMessage) =>
    cfg.canonicalUrl?.replace(/\/$/, '') ??
    `${(req.headers['x-forwarded-proto'] as string) ?? (req.headers.host?.startsWith('localhost') ? 'http' : 'https')}://${req.headers.host ?? 'localhost'}`;
  const sendParentMail = async (user: UserRecord, base: string) => {
    if (!user.parentEmail) return;
    const secret = randomBytes(24).toString('base64url');
    user.parentTokenHash = hashSecret(secret);
    user.parentSentAt = Date.now();
    store.touch();
    const link = `${base}/foraelder?t=${secret}`;
    const name = user.name;
    try {
      await sendMail({
        to: user.parentEmail,
        subject: `${name} vil gerne spille Lobbi Junior`,
        text: `Hej!\n\nEt barn har lige oprettet figuren "${name}" i Lobbi Junior og skrevet din e-mail som forælder.\n\nLobbi Junior er et hotel-spil for børn på 8–12 år. Man chatter kun med færdige sætninger, man kan ikke skrive egen tekst, og man bliver kun venner med nogen, man giver sin vennekode.\n\nSig ja eller nej her:\n${link}\n\nHvis du ikke svarer, slettes kontoen automatisk efter 7 dage.\n\nVenlig hilsen\nLobbi Junior (Breinholt Digital)`,
        html: `<p>Hej!</p><p>Et barn har lige oprettet figuren <b>${escHtml(name)}</b> i Lobbi Junior og skrevet din e-mail som forælder.</p><p>Lobbi Junior er et hotel-spil for børn på 8–12 år. Man chatter kun med færdige sætninger, man kan ikke skrive egen tekst, og man bliver kun venner med nogen, man giver sin vennekode.</p><p><a href="${link}" style="background:#ffb347;color:#3a2210;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Sig ja eller nej</a></p><p style="color:#7a5a40">Hvis du ikke svarer, slettes kontoen automatisk efter 7 dage.</p><p>Venlig hilsen<br>Lobbi Junior (Breinholt Digital)</p>`,
      });
    } catch (e) {
      console.error('Kunne ikke sende forældre-mail', e);
    }
  };
  const userByParentSecret = (secret: string) => {
    if (!secret || secret.length > 100) return undefined;
    const h = hashSecret(secret);
    return store.listUsers().find((u) => u.parentTokenHash === h);
  };
  // Junior: delete accounts no parent confirmed within 7 days.
  const sweep = cfg.junior
    ? setInterval(() => {
        const old = Date.now() - PARENT_WAIT_MS;
        for (const u of store.listUsers())
          if (!u.parentConsentAt && Date.parse(u.createdAt) < old) store.deleteUser(u.id);
      }, 3600_000)
    : null;
  sweep?.unref();
  /** Returns [status, message] if the profile can't be used, otherwise null. */
  const checkProfile = (p: { name: string; invite?: string }): [number, string] | null => {
    if (invites.length && !invites.includes((p.invite ?? '').trim().toLowerCase()))
      return [403, 'Lobbi er i lukket beta – du skal bruge en gyldig invitationskode.'];
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
      if (cfg.junior) {
        const jp = JuniorGuestSchema.safeParse(body);
        if (!jp.success)
          return json(res, 400, {
            ok: false,
            error:
              'Vælg et navn, en adgangskode på mindst 8 tegn, og få en voksen til at skrive sin e-mail og sætte flueben.',
          });
        const name = jp.data.name.trim();
        if (!isJuniorName(name))
          return json(res, 400, {
            ok: false,
            error: 'Vælg dit navn med knapperne – ikke dit rigtige navn.',
          });
        const bad = checkProfile({ name, invite: jp.data.invite });
        if (bad) return json(res, bad[0], { ok: false, error: bad[1] });
        const { user, token } = store.createUser(
          name,
          { ...freeLook(jp.data.look), beard: 'ingen' },
          {
            password: jp.data.password,
          },
        );
        user.parentEmail = jp.data.parentEmail.trim().toLowerCase();
        await sendParentMail(user, publicBase(req));
        return json(res, 200, { ok: true, token, userId: user.id, waitingForParent: true });
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
      const { user, token } = store.createUser(name, freeLook(parsed.data.look), {
        password: parsed.data.password,
      });
      return json(res, 200, { ok: true, token, userId: user.id });
    }
    if (cfg.junior && url.pathname === '/foraelder') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      let secret = url.searchParams.get('t') ?? '';
      let answer = '';
      if (req.method === 'POST') {
        const form = new URLSearchParams(await readBody(req, 2048).catch(() => ''));
        secret = form.get('t') ?? '';
        answer = form.get('svar') ?? '';
      }
      const child = userByParentSecret(secret);
      if (!child) {
        res.writeHead(404);
        return res.end(
          parentPage(
            'Linket virker ikke',
            '<h1>Linket virker ikke</h1><p>Det er brugt, for gammelt, eller kontoen er slettet. Har barnet lavet en ny figur, kommer der en ny mail.</p>',
          ),
        );
      }
      if (req.method === 'POST' && answer === 'ja') {
        child.parentConsentAt = Date.now();
        delete child.parentTokenHash;
        store.touch();
        res.writeHead(200);
        return res.end(
          parentPage(
            'Tak',
            `<h1>Tak! 🎉</h1><p><b>${escHtml(child.name)}</b> kan nu spille Lobbi Junior. Barnet skal bare logge ind igen.</p><p><small>Vil du senere have kontoen slettet, så skriv til rune@breinholtdigital.dk.</small></p>`,
          ),
        );
      }
      if (req.method === 'POST' && answer === 'nej') {
        const name = child.name;
        store.deleteUser(child.id);
        res.writeHead(200);
        return res.end(
          parentPage(
            'Slettet',
            `<h1>Kontoen er slettet</h1><p>Figuren <b>${escHtml(name)}</b> og alt, der hørte til, er slettet. Vi gemmer ikke din e-mail.</p>`,
          ),
        );
      }
      res.writeHead(200);
      return res.end(
        parentPage(
          'Sig ja eller nej',
          `<h1>Må ${escHtml(child.name)} spille Lobbi Junior?</h1>
<p>Lobbi Junior er et hotel-spil for børn på 8–12 år. Børnene laver en figur, indretter et værelse og leger med andre.</p>
<ul><li>Man chatter kun med færdige sætninger – ingen kan skrive egen tekst.</li><li>Man bliver kun venner med nogen, man giver sin vennekode.</li><li>Ingen reklamer, ingen køb med rigtige penge, og vi beder aldrig om barnets rigtige navn.</li><li>Vi gemmer kun figuren, værelset, din e-mail og chatten i 30 dage (til moderation).</li></ul>
<form method="post"><input type="hidden" name="t" value="${escHtml(secret)}"><button class="yes" name="svar" value="ja">Ja, mit barn må spille</button><button class="no" name="svar" value="nej">Nej, slet kontoen</button></form>
<p><small>Læs <a href="https://lobbi.dk/junior/privatliv/">vilkår og privatlivspolitik</a>.</small></p>`,
        ),
      );
    }
    if (req.method === 'POST' && url.pathname === '/api/parent/resend') {
      if (!cfg.junior) return json(res, 404, { ok: false, error: 'not_found' });
      let token = '';
      try {
        token = (JSON.parse(await readBody(req, 1024)) as { token?: string }).token ?? '';
      } catch {
        /* handled below */
      }
      const user = token ? store.getUserByToken(token) : undefined;
      if (!user || user.parentConsentAt)
        return json(res, 400, { ok: false, error: 'Ingen konto venter.' });
      if (user.parentSentAt && Date.now() - user.parentSentAt < PARENT_RESEND_MS)
        return json(res, 429, { ok: false, error: 'Vent 10 minutter, før du sender igen.' });
      await sendParentMail(user, publicBase(req));
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, {
        ok: true,
        edition: cfg.junior ? 'junior' : 'adult',
        // Junior: name + password only – no Google/e-mail login for children.
        auth: verify && !cfg.junior ? 'supabase' : 'password',
        supabaseUrl: cfg.supabaseUrl ?? null,
        supabaseAnonKey: cfg.supabaseAnonKey ?? null,
        inviteRequired: invites.length > 0,
        providers: verify && !cfg.junior ? (cfg.authProviders ?? ['google']) : [],
        canonicalUrl: cfg.canonicalUrl ?? null,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/session') {
      if (!verify || cfg.junior) return json(res, 404, { ok: false, error: 'not_found' });
      const ip = clientIp(req);
      if (!sessionLimiter.take(ip))
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
      const claimed = store.getUserByName(profile.name.trim());
      const claimEmail = claimed && cfg.claimNames?.[claimed.name.toLowerCase()];
      if (claimed && !claimed.authId && claimEmail && who.email?.toLowerCase() === claimEmail) {
        // Rune has approved (via CLAIM_NAMES) that this e-mail may take over the old account.
        claimed.authId = who.id;
        store.touch();
        return json(res, 200, { ok: true, token: store.rotateToken(claimed), userId: claimed.id });
      }
      const old = profile.password ? claimed : undefined;
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
      const { user, token } = store.createUser(profile.name.trim(), freeLook(profile.look), {
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
        // Hashed assets can be cached forever; index.html must always be fresh after a deploy.
        const hashed = rel.includes('assets') && /-[\w-]{8,}\./.test(rel);
        res.writeHead(200, {
          'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
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
        if (sweep) clearInterval(sweep);
        hotel.stop();
        for (const c of wss.clients) c.terminate();
        wss.close();
        server.close(() => r());
      }),
  };
}
