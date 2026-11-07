/** "Prøv at lave din figur": one figure on a little stage, changed with chips. */
import { DEFAULT_LOOK, GENDERS, GLASSES, HAIR_STYLES, PALETTE, type Look } from '@hutel/shared';
import { buildParts, makeAvatar } from '@game/gfx/avatar';
import { cyl, M, T } from '@game/gfx/helpers';
import { miniStage } from './stage';

const TOPS = ['tshirt', 'stribet', 'hoodie', 'kjole', 'dunjakke', 'skjorte'] as const;
const HATS = ['ingen', 'hue', 'baret', 'solhat', 'cowboy'] as const;
const NAMES: Record<string, string> = {
  kvinde: 'Kvinde',
  mand: 'Mand',
  andet: 'Vil ikke sige',
  kort: 'Kort',
  krøller: 'Krøller',
  hestehale: 'Hestehale',
  langt: 'Langt',
  kasket: 'Kasket',
  skaldet: 'Skaldet',
  ingen: 'Ingen',
  runde: 'Runde',
  sol: 'Solbriller',
  tshirt: 'T-shirt',
  stribet: 'Stribet',
  hoodie: 'Hættetrøje',
  kjole: 'Kjole',
  dunjakke: 'Dunjakke',
  skjorte: 'Skjorte',
  hue: 'Hue',
  baret: 'Baret',
  solhat: 'Solhat',
  cowboy: 'Cowboyhat',
};

export function startFigure(el: HTMLElement, controls: HTMLElement) {
  const stage = miniStage(el, { view: 1.25, target: [0, 0.75, 0], transparent: true });
  let look: Look = {
    ...DEFAULT_LOOK,
    hairStyle: 'krøller',
    hair: 0xd9a35b,
    shirt: 0x3f7f86,
    top: 'hoodie',
  };
  const fig = makeAvatar(look);
  stage.scene.add(fig);
  const plinth = cyl(0.62, 0.66, 0.12, M(0x5e3820, { roughness: 0.6 }), 0, -0.06, 0, 40);
  plinth.receiveShadow = true;
  stage.scene.add(plinth);

  const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
  const rows: {
    label: string;
    key: keyof Look;
    vals: readonly (string | number)[];
    color?: boolean;
  }[] = [
    { label: 'Køn', key: 'gender', vals: GENDERS },
    { label: 'Frisure', key: 'hairStyle', vals: HAIR_STYLES },
    { label: 'Overdel', key: 'top', vals: TOPS },
    { label: 'Hat', key: 'hat', vals: HATS },
    { label: 'Briller', key: 'glasses', vals: GLASSES },
    { label: 'Hud', key: 'skin', vals: PALETTE.skin, color: true },
    { label: 'Hår', key: 'hair', vals: PALETTE.hair, color: true },
    { label: 'Trøje', key: 'shirt', vals: PALETTE.shirt, color: true },
  ];
  function render() {
    controls.replaceChildren(
      ...rows.map((r) => {
        const row = document.createElement('div');
        row.className = 'fig-row';
        const lab = document.createElement('span');
        lab.className = 'fig-label';
        lab.textContent = r.label;
        const opts = document.createElement('div');
        opts.className = r.color ? 'fig-swatches' : 'fig-chips';
        for (const v of r.vals) {
          const b = document.createElement('button');
          b.type = 'button';
          const cur =
            (look[r.key] ??
              (r.key === 'hat'
                ? 'ingen'
                : r.key === 'top'
                  ? 'tshirt'
                  : r.key === 'gender'
                    ? 'andet'
                    : undefined)) === v;
          b.setAttribute('aria-pressed', String(cur));
          if (r.color) {
            b.style.background = hex(v as number);
            b.setAttribute('aria-label', `${r.label} ${hex(v as number)}`);
          } else b.textContent = NAMES[v as string] ?? String(v);
          b.onclick = () => {
            look = { ...look, [r.key]: v } as Look;
            buildParts(fig, look);
            render();
          };
          opts.appendChild(b);
        }
        row.append(lab, opts);
        return row;
      }),
    );
  }
  render();

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new T.Clock();
  let blink = 3;
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!reduce) fig.rotation.y = Math.sin(t * 0.5) * 0.6;
    const u = fig.userData as { eyes: T.Group[]; head: T.Group };
    blink -= dt;
    u.eyes.forEach((e) => (e.scale.y = blink < 0 ? 0.1 : 1));
    if (blink < -0.13) blink = 2 + Math.random() * 3;
    u.head.rotation.z = Math.sin(t * 1.3) * 0.05;
    stage.render();
  }
  loop();
}
