/** A small turning figure that shows how you will look while you pick clothes and colours. */
import type { Look } from '@hutel/shared';
import { buildParts, makeAvatar } from './avatar';
import { cyl, M, T } from './helpers';

export function figurePreview(el: HTMLElement, look: Look) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  el.appendChild(renderer.domElement);

  const scene = new T.Scene();
  const target: [number, number, number] = [0, 0.75, 0];
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(11, 10.95, 11);
  camera.lookAt(...target);
  scene.add(new T.HemisphereLight(0xffe4c4, 0x4a3226, 0.75));
  const sun = new T.DirectionalLight(0xffc896, 0.9);
  sun.position.set(7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 40 });
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new T.DirectionalLight(0xa8c4ff, 0.35);
  rim.position.set(-8, 7, -6);
  scene.add(rim);

  const fig = makeAvatar(look);
  scene.add(fig);
  const plinth = cyl(0.62, 0.66, 0.12, M(0xe8cfa8, { roughness: 0.7 }), 0, -0.06, 0, 40);
  plinth.receiveShadow = true;
  scene.add(plinth);

  const view = 1.2;
  let w = 0;
  let h = 0;
  const resize = () => {
    const nw = Math.max(1, el.clientWidth);
    const nh = Math.max(1, el.clientHeight);
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    const a = w / h;
    const v = Math.max(view, (view * 1.1) / a);
    Object.assign(camera, { left: -v * a, right: v * a, top: v, bottom: -v });
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new T.Clock();
  let blink = 3;
  const loop = () => {
    requestAnimationFrame(loop);
    // Only draw while the sign-up page is on screen.
    if (!el.offsetParent) return;
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!reduce) fig.rotation.y = Math.sin(t * 0.5) * 0.6;
    const u = fig.userData as { eyes: T.Group[]; head: T.Group };
    blink -= dt;
    u.eyes.forEach((e) => (e.scale.y = blink < 0 ? 0.1 : 1));
    if (blink < -0.13) blink = 2 + Math.random() * 3;
    u.head.rotation.z = Math.sin(t * 1.3) * 0.05;
    renderer.render(scene, camera);
  };
  loop();

  return { update: (l: Look) => buildParts(fig, l) };
}
