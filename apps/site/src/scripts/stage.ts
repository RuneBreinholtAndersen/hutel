/** A small version of the game's renderer that fits a container instead of the window. */
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
import { T } from '@game/gfx/helpers';

export function miniStage(
  el: HTMLElement,
  opts: {
    view: number;
    target: [number, number, number];
    /** See-through canvas (no bloom) so the page shows behind it. */
    transparent?: boolean;
    /** Move the scene sideways, as a share of the width (0.2 = 20 % to the right). */
    shiftX?: number;
  },
) {
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: !!opts.transparent });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  el.appendChild(renderer.domElement);

  const scene = new T.Scene();
  if (!opts.transparent) {
    // Same sunset sky as in the game.
    const bg = document.createElement('canvas');
    bg.width = 4;
    bg.height = 256;
    const g = bg.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#2a1b33');
    gr.addColorStop(0.55, '#6a3f45');
    gr.addColorStop(1, '#2a1a22');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    const tex = new T.CanvasTexture(bg);
    tex.encoding = T.sRGBEncoding;
    scene.background = tex;
  } else renderer.setClearColor(0x000000, 0);
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(11 + opts.target[0], 10.2 + opts.target[1], 11 + opts.target[2]);
  camera.lookAt(...opts.target);

  scene.add(new T.HemisphereLight(0xffe4c4, 0x4a3226, 0.7));
  const sun = new T.DirectionalLight(0xffc896, 0.85);
  sun.position.set(7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new T.DirectionalLight(0xa8c4ff, 0.35);
  rim.position.set(-8, 7, -6);
  scene.add(rim);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(el.clientWidth, el.clientHeight), 0.5, 0.6, 0.8);
  composer.addPass(bloom);
  composer.addPass(new ShaderPass(GammaCorrectionShader));

  function resize() {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    const a = w / h;
    const v = Math.max(opts.view, (opts.view * 1.25) / a);
    const shift = (opts.shiftX ?? 0) * 2 * v * a;
    camera.left = -v * a - shift;
    camera.right = v * a - shift;
    camera.top = v;
    camera.bottom = -v;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    composer.setSize(w, h);
  }
  resize();
  new ResizeObserver(resize).observe(el);

  const v3 = new T.Vector3();
  /** Screen position (in the container) of a point above an object. */
  const project = (o: T.Object3D, y: number): [number, number] => {
    v3.set(o.position.x, o.position.y + y, o.position.z).project(camera);
    return [((v3.x + 1) / 2) * el.clientWidth, ((1 - v3.y) / 2) * el.clientHeight];
  };

  const render = () => (opts.transparent ? renderer.render(scene, camera) : composer.render());
  return { renderer, scene, camera, render, project };
}
