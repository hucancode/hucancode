// Shared playground lifecycle: canvas sizing (dpr-clamped), device creation
// with async-dispose race guard, per-frame size sync, clamped dt. A playground
// module becomes: export const { init, render, destroy } = createPlayground({...}).
import { createDevice } from "./gpu/index.js";
import { Camera } from "./camera.js";

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const MAX_DT = 0.05;

export function createPlayground({ camera: camSpec, device: devSpec, init, frame, destroy, setConfig } = {}) {
  let canvas = null, device = null, camera = null;
  let disposed = false, lastT = 0;

  function syncSize() {
    const dpr = DPR();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const tw = Math.max(1, Math.floor(w * dpr)), th = Math.max(1, Math.floor(h * dpr));
    if (canvas.width === tw && canvas.height === th) return;
    canvas.width = tw; canvas.height = th;
    device.resize(tw, th);
    if (camera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const ctx = {
    get canvas() { return canvas; },
    get device() { return device; },
    get camera() { return camera; },
    get aspect() { return canvas.height > 0 ? canvas.width / canvas.height : 1; },
    // for init() to re-check after its own awaits (asset loads)
    disposed: () => disposed,
  };

  return {
    async init(canvasEl) {
      canvas = canvasEl;
      disposed = false;
      const dpr = DPR();
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      device = await createDevice(canvas, devSpec);
      if (disposed) { device.destroy(); device = null; return; }
      device.resize(canvas.width, canvas.height);
      if (camSpec) {
        const { fov = 45, near = 1, far = 2000 } = camSpec;
        camera = new Camera(fov, canvas.clientWidth / canvas.clientHeight, near, far);
      }
      await init?.(ctx);
      if (disposed && device) { device.destroy(); device = null; return; }
      lastT = performance.now();
    },
    // returns the dt it used, so a page can drive its own clocks (autoplay,
    // scrub, scroll) off the same one instead of running a second RAF.
    render() {
      if (!device) return 0;
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, MAX_DT);
      lastT = now;
      syncSize();
      frame(dt, ctx);
      return dt;
    },
    setConfig,
    destroy() {
      disposed = true;
      destroy?.(ctx);
      if (device) { device.destroy(); device = null; }
      canvas = null; camera = null;
    },
  };
}
