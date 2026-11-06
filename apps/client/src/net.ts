import type { ClientMsg, ServerMsg } from '@hutel/shared';

type Handler = (msg: ServerMsg) => void;

/** WebSocket connection with automatic reconnect and server clock sync. */
export class Net {
  private ws: WebSocket | null = null;
  private retry = 0;
  private stopped = false;
  private clockOffset = 0;
  private pingTimer: number | undefined;
  onMessage: Handler = () => {};
  onStatus: (s: 'connecting' | 'online' | 'offline') => void = () => {};
  onFatal: (code: number) => void = () => {};

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  /** Server time in ms (used to animate paths in sync with the server). */
  now() {
    return Date.now() + this.clockOffset;
  }

  connect() {
    this.onStatus('connecting');
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('online');
      this.send({ t: 'auth', token: this.token });
      clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if ('serverTime' in msg) this.clockOffset = msg.serverTime - Date.now();
      this.onMessage(msg);
    };
    ws.onclose = (e) => {
      clearInterval(this.pingTimer);
      if ([4000, 4001, 4003].includes(e.code)) {
        this.stopped = true;
        this.onFatal(e.code);
      }
      if (this.stopped) return;
      this.onStatus('offline');
      const delay = Math.min(15_000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.stopped = true;
    this.ws?.close();
  }
}
