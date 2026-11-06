import { createServer, type Server } from 'node:http';
import { ROOM_SIZE } from '@hutel/shared';

export const VERSION = '0.0.0';

/** Creates the HTTP server. Colyseus attaches to this server in Milepæl 1. */
export function createApp(clientOrigin: string): Server {
  return createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', clientOrigin);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'hutel-server',
          version: VERSION,
          roomSize: ROOM_SIZE,
        }),
      );
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  });
}
