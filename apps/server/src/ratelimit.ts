/** Simple token bucket: `capacity` actions, refilled at `perSecond`. */
export class Bucket {
  private tokens: number;
  private last = Date.now();
  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
  ) {
    this.tokens = capacity;
  }
  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((now - this.last) / 1000) * this.perSecond,
    );
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

export type LimitKind = 'any' | 'move' | 'glide' | 'chat' | 'build' | 'social';

export function createLimits(): Record<LimitKind, Bucket> {
  return {
    any: new Bucket(40, 20),
    move: new Bucket(16, 10),
    glide: new Bucket(30, 15),
    chat: new Bucket(5, 0.5),
    build: new Bucket(8, 3),
    social: new Bucket(6, 0.5),
  };
}

/** Per-key limiter for HTTP endpoints (e.g. guest sign-ups per IP). */
export class KeyedLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private readonly capacity: number,
    private readonly perSecond: number,
  ) {}
  take(key: string): boolean {
    let b = this.buckets.get(key);
    if (!b) {
      if (this.buckets.size > 10_000) this.buckets.clear();
      b = new Bucket(this.capacity, this.perSecond);
      this.buckets.set(key, b);
    }
    return b.take();
  }
}
