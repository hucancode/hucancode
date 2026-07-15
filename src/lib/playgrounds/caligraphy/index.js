import { createPlayground, F32, I32, VEC2 } from "$lib/engine/index.js";
import CALI from "./shaders/caligraphy-playground.wgsl?shader";

const TEXELS_PER_SEG = 5;

// playhead undefined = edit view (every seg fully revealed)
const config = {
  segs: [],
  baseRadius: 0.07,
  view: { zoom: 1, panX: 0, panY: 0 },
  showGrid: true,
  gridSize: 1.6,
  playhead: undefined,
};

let shader = null, segTex = null;
let buf = new Float32Array(0);
let nSeg = 0;
let segRef = null; // re-pack only on segs identity change (page bakes in a $derived)

function setConfig(patch) {
  Object.assign(config, patch);
}

// pack baked segs into RGBA32F texture (width=5, height=NSEG); texel 0 = header (center.xy, hullRadius, t0)
function packSegs(segs) {
  const n = segs.length;
  if (n === 0) return 0;
  const need = n * TEXELS_PER_SEG * 4;
  if (buf.length < need) buf = new Float32Array(need);
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    const cx = (s.p1.x + s.p2.x) * 0.5;
    const cy = (s.p1.y + s.p2.y) * 0.5;
    const d1 = Math.hypot(s.p1.x - cx, s.p1.y - cy);
    const dc = Math.hypot(s.ctrl.x - cx, s.ctrl.y - cy);
    const hullR = Math.max(d1, dc);
    let o = i * TEXELS_PER_SEG * 4;
    buf[o++] = cx; buf[o++] = cy; buf[o++] = hullR; buf[o++] = s.t0;
    buf[o++] = s.p1.x; buf[o++] = s.p1.y; buf[o++] = s.p2.x; buf[o++] = s.p2.y;
    buf[o++] = s.ctrl.x; buf[o++] = s.ctrl.y; buf[o++] = s.pr1; buf[o++] = s.pr2;
    buf[o++] = s.k; buf[o++] = s.belly; buf[o++] = s.dur; buf[o++] = 0;
    buf[o++] = s.v0; buf[o++] = s.v1; buf[o++] = 0; buf[o++] = 0;
  }
  segTex.write(buf.subarray(0, need), TEXELS_PER_SEG, n);
  return n;
}

const { init, render, destroy } = createPlayground({
  // no MSAA: one fullscreen tri, every edge is analytic AA in the fragment
  // shader; multisampling would only burn a hidden 4x target + resolve.
  device: { msaa: false },
  init({ device }) {
    shader = device.shader({
      ...CALI,
      uniforms: [
        VEC2("uResolution"), F32("uBaseRadius"), F32("uZoom"), VEC2("uPan"),
        F32("uGridSize"), I32("uShowGrid"), F32("uTime"), I32("uNSeg"),
      ],
      textures: [{ name: "uSegTex", binding: 1 }],
      blend: "none", topology: "tri",
    });
    segTex = device.texture({ width: TEXELS_PER_SEG, height: 1, format: "rgba32f", filter: "nearest" });
  },
  frame(dt, { device, canvas }) {
    const w = canvas.width, h = canvas.height;
    if (w <= 0 || h <= 0) return;
    if (config.segs !== segRef) {
      nSeg = packSegs(config.segs);
      segRef = config.segs;
    }
    const view = config.view;
    device.beginFrame();
    device.pass({ clear: [1.0, 0.988, 0.878, 1.0] }, (p) => {
      if (nSeg <= 0) return;
      p.draw(shader, {
        count: 3,
        textures: { uSegTex: segTex },
        uniforms: {
          uResolution: [w, h],
          uBaseRadius: config.baseRadius,
          uZoom: view.zoom,
          uPan: [view.panX, view.panY],
          uGridSize: config.gridSize,
          uShowGrid: config.showGrid ? 1 : 0,
          // no playhead = edit view; +inf time reveals every seg exactly
          uTime: config.playhead ?? 1e9,
          uNSeg: nSeg,
        },
      });
    });
    device.endFrame();
  },
  destroy() {
    segTex?.destroy();
    shader = segTex = segRef = null;
    nSeg = 0;
  },
});

export { init, render, destroy, setConfig, config };
