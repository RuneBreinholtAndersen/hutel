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
import { JsonFileStore, type Store } from './store';

export const VERSION = '0.1.0';

export interface AppConfig extends HotelConfig {
  clientOrigins: string[];
  dataFile: string | null;
  /** Folder with the built client to serve (optional, for single-server deploys). */
  clientDist: string | null;
  /** Guest sign-ups allowed per IP per hour. */
  signupsPerHour?: number;
}

const GuestSchema = z.object({
  name: z.string().min(2).max(16),
  look: LookSchema,
  adult: z.literal(true),
  terms: z.literal(true),
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
      const ip = (req.headers['fly-client-ip'] as string) ?? req.socket.remoteAddress ?? 'unknown';
      if (!signupLimiter.take(ip)) return json(res, 429, { ok: false, error: 'Prøv igen senere.' });
      let body: unknown;
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { ok: false, error: 'Ugyldig forespørgsel.' });
      }
      const parsed = GuestSchema.safeParse(body);
      if (!parsed.success)
        return json(res, 400, { ok: false, error: 'Udfyld navn, figur og bekræft 18+ og vilkår.' });
      const name = parsed.data.name.trim();
      if (!isValidName(name))
        return json(res, 400, {
          ok: false,
          error: 'Navnet må kun have bogstaver, tal, mellemrum, - og _ (2–16 tegn).',
        });
      if (
        store.getUserByName(name) ||
        ['ida', 'magnus', 'luna', 'oskar', 'admin', 'moderator', 'hutel'].includes(
          name.toLowerCase(),
        )
      )
        return json(res, 409, { ok: false, error: 'Navnet er taget – prøv et andet.' });
      const { user, token } = store.createUser(name, parsed.data.look);
      return json(res, 200, { ok: true, token, userId: user.id });
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
    if (url.pathname !== '/ws' || !allowed(req.headers.origin)) {
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
