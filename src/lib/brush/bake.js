import {
  resolveControl,
  sampleSeg,
  pointSpeed,
  travelTime,
  expandStrokes,
} from "./engine.js";

export function bakeSegs(symbol, opts = {}) {
  const connect = opts.connect || { enabled: true, thread: 0.18 };
  const speed = opts.timing ? opts.timing.speed : 1.0;

  const expanded = expandStrokes(symbol, connect);
  const segs = [];
  let cursor = 0;
  for (const e of expanded) {
    const stroke = e.stroke;
    for (let i = 0; i < stroke.paths.length; i++) {
      const path = stroke.paths[i];
      const p1 = stroke.points[i], p2 = stroke.points[i + 1];
      const c = resolveControl(stroke, i);
      const v0 = pointSpeed(stroke, i, speed), v1 = pointSpeed(stroke, i + 1, speed);
      const { arc: L, bellyX } = sampleSeg(stroke, i);
      const dur = travelTime(L, v0, v1);
      // no pctrl -> belly 0.5 with k = mid-pressure: the pressure quad then
      // degenerates to exactly mix(pr1, pr2, s), so shaders never branch.
      const k = path.pctrl ? path.pctrl.k : (p1.pressure + p2.pressure) / 2;
      const belly = path.pctrl ? bellyX : 0.5;
      segs.push({
        p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y }, ctrl: c,
        pr1: p1.pressure, pr2: p2.pressure, k, belly,
        t0: cursor, dur, v0, v1, connector: e.connector ? 1 : 0, stroke: e.si,
      });
      cursor += dur;
    }
  }
  return { segs, strokeCount: expanded.length, total: cursor };
}

export function bakeGLSL(symbol, opts = {}) {
  const glyph = opts.glyph || "?";
  const { segs, strokeCount: expandedCount, total } = bakeSegs(symbol, opts);

  const f = n => {
    const s = Number(n).toFixed(5);
    return s.replace(/0+$/, "").replace(/\.$/, ".0");
  };
  const v2 = p => `vec2(${f(p.x)}, ${f(p.y)})`;
  const N = segs.length;
  let out = "";
  out += `// ===== BAKED by src/lib/brush/bake.js - DO NOT HAND-EDIT =====\n`;
  out += `// ${glyph}, ${expandedCount} strokes expanded with auto connectors (牽絲), auto timing.\n`;
  out += `// Each Seg is self-contained: endpoints, control, pressures, belly, timeline.\n`;
  out += `//   p1,p2   segment endpoints (world)\n`;
  out += `//   ctrl    resolved bezier control (auto Catmull-rom already applied)\n`;
  out += `//   pr1,pr2 endpoint pressures (0..1)\n`;
  out += `//   k,belly pressure quad through (belly,k); linear segs baked as belly=0.5, k=mid\n`;
  out += `//   t0,dur  reveal timeline (seconds); v0,v1 endpoint speeds (reveal shape)\n`;
  out += `struct Seg {\n`;
  out += `    vec2 p1; vec2 p2; vec2 ctrl;\n`;
  out += `    float pr1; float pr2; float k; float belly;\n`;
  out += `    float t0; float dur; float v0; float v1;\n`;
  out += `};\n`;
  out += `const int NSEG = ${N};\n`;
  out += `const float TOTAL_TIME = ${f(total)};\n`;
  out += `const Seg SEGS[NSEG] = Seg[NSEG](\n`;
  out += segs.map(s =>
    `    Seg(${v2(s.p1)}, ${v2(s.p2)}, ${v2(s.ctrl)}, ` +
    `${f(s.pr1)}, ${f(s.pr2)}, ${f(s.k)}, ${f(s.belly)}, ` +
    `${f(s.t0)}, ${f(s.dur)}, ${f(s.v0)}, ${f(s.v1)})`
  ).join(",\n");
  out += `\n);\n`;

  return { glsl: out, segCount: N, strokeCount: expandedCount, total };
}
