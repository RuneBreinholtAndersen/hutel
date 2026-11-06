import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
import { T } from './helpers';

export function createStage(container: HTMLElement) {
  const renderer = new T.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new T.Scene();
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
  const bgTex = new T.CanvasTexture(bg);
  bgTex.encoding = T.sRGBEncoding;
  scene.background = bgTex;

  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(11, 10.2, 11);
  camera.lookAt(-0.2, 0.9, -0.2);

  scene.add(new T.HemisphereLight(0xffe4c4, 0x4a3226, 0.7));
  const sun = new T.DirectionalLight(0xffc896, 0.85);
  sun.position.set(7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new T.DirectionalLight(0xa8c4ff, 0.35);
  rim.position.set(-8, 7, -6);
  scene.add(rim);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.8));
  composer.addPass(new ShaderPass(GammaCorrectionShader));

  /** Bigger rooms zoom the camera out (a bit less than linearly, so figures stay readable). */
  let roomScale = 1;
  function resize() {
    const a = innerWidth / innerHeight;
    const v = Math.max(5.4, 6.6 / a) * roomScale;
    camera.left = -v * a;
    camera.right = v * a;
    camera.top = v;
    camera.bottom = -v;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    composer.setSize(innerWidth, innerHeight);
  }
  resize();
  addEventListener('resize', resize);

  renderer.domElement.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      camera.zoom = Math.min(2.2, Math.max(0.7, camera.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
      camera.updateProjectionMatrix();
    },
    { passive: false },
  );

  function setRoomSize(n: number) {
    roomScale = 1 + Math.max(0, n - 8) * 0.1;
    const h = Math.max(8, n * 0.75);
    Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h });
    sun.shadow.camera.updateProjectionMatrix();
    resize();
  }

  return { renderer, scene, camera, composer, setRoomSize, render: () => composer.render() };
}
export type Stage = ReturnType<typeof createStage>;
