// RENDER ENGINE — draws procedurally generated MESHES (triangle soup), no SDF.
// INSTANCED: the model is { items: [{ key, m, t, color }], meshes: {key: soup} }
// (parts.js/rig.js emit instance handles — a unit-mesh key + affine transform).
// The shared drawer (lib/mech/instancing.js) groups items by key and issues
// ONE instanced draw per key, reusing GPU buffers across model patches.
import { createPlayground, createOrbit, mat4, F32, VEC3, MAT4 } from "$lib/engine/index.js";
import { INSTANCED_PROGRAM, createInstancedDrawer } from "$lib/mech/instancing.js";
import GRID_WGSL from "./shaders/grid.wgsl?raw";
import GRID_VERT from "./shaders/grid.vert.glsl?raw";
import GRID_FRAG from "./shaders/grid.frag.glsl?raw";

const BG = [0.07, 0.09, 0.13, 1];
const LIGHT_R = 30, LIGHT_Y = 40;
// grid on the XZ plane through y=0 -> marks every part's local origin
const GROUND = { ext: 7, y: 0, step: 0.5, minorDiv: 5, opacity: 0.55, color: [0.45, 0.5, 0.58] };

// FIXED camera: orbit around the origin with constant defaults — no auto-fit,
// the user frames the subject with drag + wheel
const VIEW0 = { yaw: 0.7, pitch: 0.25, dist: 6 };

let shader, gridShader, drawer, orbit;
let model = null;                  // current { items, meshes }
const view = { ...VIEW0 };         // desired framing; orbit adopts it lazily (patches may precede init)

const config = {
  spin: 0.3,        // auto-rotate speed
  lightAngle: 0.6,  // light orbit position
};

function setConfig(patch) {
  if ("spin" in patch) config.spin = patch.spin;
  if ("lightAngle" in patch) config.lightAngle = patch.lightAngle;
  if ("dist" in patch) view.dist = patch.dist;                // page-chosen framing, still not auto
  if (patch.resetView) {
    view.yaw = VIEW0.yaw; view.pitch = VIEW0.pitch; view.dist = patch.dist ?? VIEW0.dist;
  }
  if (orbit && ("dist" in patch || patch.resetView)) {
    orbit.yaw = view.yaw; orbit.pitch = view.pitch; orbit.dist = view.dist;
  }
  if (patch.model) model = patch.model;
}

const _vp = mat4.create();

const { init, render, destroy } = createPlayground({
  camera: { fov: 45, near: 0.05, far: 500 },
  init({ device, canvas }) {
    shader = device.shader({
      ...INSTANCED_PROGRAM,
      depth: "test", blend: "straight", topology: "tri", target: "screen", sampleCount: 4,
    });
    gridShader = device.shader({
      glsl: { vertex: GRID_VERT, fragment: GRID_FRAG }, wgsl: GRID_WGSL,
      uniforms: [
        MAT4("uViewProj"), F32("uExt"), F32("uY"), F32("uStep"),
        F32("uMinorDiv"), F32("uOpacity"), VEC3("uColor"),
      ],
      depth: "none", blend: "premult", topology: "tri-strip", target: "screen", sampleCount: 4,
    });
    drawer = createInstancedDrawer(device);
    orbit = createOrbit(canvas, { ...view, wheel: true });
  },
  frame(dt, { device, camera }) {
    if (!orbit.dragging) orbit.yaw += config.spin * dt * 0.5;
    orbit.placeCamera(camera);
    mat4.copy(_vp, device.correctViewProj(camera.viewProjMatrix));
    const eye = [camera.position.x, camera.position.y, camera.position.z];
    const la = config.lightAngle;
    const light = [Math.cos(la) * LIGHT_R, LIGHT_Y, Math.sin(la) * LIGHT_R];

    device.beginFrame();
    device.pass({ target: "screen", clear: BG, depth: true, depthClear: 1 }, (p) => {
      p.draw(gridShader, {
        count: 4,
        uniforms: {
          uViewProj: _vp, uExt: GROUND.ext, uY: GROUND.y, uStep: GROUND.step,
          uMinorDiv: GROUND.minorDiv, uOpacity: GROUND.opacity, uColor: GROUND.color,
        },
      });
      if (model)
        drawer.draw(p, shader, model.items, model.meshes, {
          uViewProj: _vp, uLightPos: light, uViewPos: eye, uOpacity: 1,
        });
    });
    device.endFrame();
  },
  destroy() {
    orbit?.detach();
    orbit = null;
    drawer?.destroy();
    drawer = null;
    model = null;
    shader = null;
    gridShader = null;
  },
});

export { init, render, destroy, setConfig };
