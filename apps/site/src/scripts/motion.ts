/**
 * Makes every page feel a bit like the game: things slide in as you scroll,
 * and little speech bubbles pop up and float away in `.chatter` boxes.
 */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- slide in on scroll ---------- */
const AUTO = [
  'main section:not(.hero) .wrap > *',
  '.prose > *',
  '.things > li',
  '.directory li',
  '.safe > li',
  '.news > article',
  '.steps > li',
  '.choice',
];
export function startReveal() {
  const els = document.querySelectorAll<HTMLElement>(AUTO.join(','));
  if (reduce || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('in');
        io.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  // Siblings that come in together get a small delay each, so lists "deal out".
  const seen = new Map<Element, number>();
  els.forEach((el) => {
    if (el.closest('.hero')) return;
    const parent = el.parentElement!;
    const i = seen.get(parent) ?? 0;
    seen.set(parent, i + 1);
    el.style.setProperty('--d', `${Math.min(i, 8) * 70}ms`);
    el.classList.add('reveal');
    io.observe(el);
  });
}

/* ---------- floating chat bubbles ---------- */
const NAMES = ['Sofie', 'Jonas', 'Mette', 'Ali', 'Ida 🤖', 'Kasper', 'Line', 'Emil'];
export function startChatter(root: HTMLElement) {
  const lines = (root.dataset.lines ?? '').split('|').filter(Boolean);
  const names = (root.dataset.names ?? '').split('|').filter(Boolean);
  const who = names.length ? names : NAMES;
  if (!lines.length) return;
  let n = Math.floor(Math.random() * lines.length);
  const spawn = () => {
    if (document.hidden || root.childElementCount > 4) return;
    const b = document.createElement('div');
    b.className = 'chat-pop';
    const name = document.createElement('b');
    name.textContent = who[Math.floor(Math.random() * who.length)]! + ': ';
    b.append(name, lines[n++ % lines.length]!);
    b.style.left = `${6 + Math.random() * 64}%`;
    b.style.top = `${30 + Math.random() * 50}%`;
    root.append(b);
    b.addEventListener('animationend', () => b.remove());
  };
  if (reduce) {
    // Still show a couple, just without movement.
    for (let i = 0; i < 2; i++) spawn();
    root.querySelectorAll('.chat-pop').forEach((b) => b.classList.add('still'));
    return;
  }
  let visible = false;
  new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting)).observe(root);
  spawn();
  setInterval(() => visible && spawn(), 1900);
}

export function startMotion() {
  startReveal();
  document.querySelectorAll<HTMLElement>('.chatter').forEach(startChatter);
}
