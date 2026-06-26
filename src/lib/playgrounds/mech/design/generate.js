// MECH DESIGN ENGINE
// Turns a small set of artistic parameters into a list of render primitives.
// It knows design; it does NOT know how primitives are drawn. Output is the same
// flat node format the render engine packs ({type,pos,rot,dims,op,round,k,color,
// stage,sym}). The render engine never imports this file.
//
// Principles encoded below (referenced by NAME in the code):
//   SYMMETRY      bilateral — author one side, emit `sym` so render mirrors it.
//   PROPORTION    a canon of ratios off a base unit U (φ where it reads well).
//   HIERARCHY     primary masses (torso/pelvis) > secondary (limbs) > tertiary
//                 (detail); bevel + size scale with rank.
//   SILHOUETTE    heroic read: shoulders wider than hips, stable foot base.
//   RHYTHM        repeated detail (vents/bolts) on an even beat, seed-jittered.
//   FOCAL POINT   one accent hue + the glowing cockpit, placed on the upper third.
//   CONTRAST      big smooth plates against small sharp detail.

import { rng } from "./rng.js";
import { PALETTE } from "./palette.js";

const PHI = 1.618;

// archetypes = named points in the parameter space (a "canon" each). vanguard is
// the reference build; titan/scout are proportional re-castings of the same body.
export const ARCHETYPES = [
  { id: "vanguard", name: "Vanguard (heroic)", params: { u: 1.0, shoulderW: 1.0, hipW: 1.0, limb: 1.0, reach: 1.0, head: 1.0 } },
  { id: "titan", name: "Titan (heavy)", params: { u: 1.12, shoulderW: 1.22, hipW: 1.14, limb: 1.34, reach: 0.92, head: 0.85 } },
  { id: "scout", name: "Scout (light)", params: { u: 0.9, shoulderW: 0.88, hipW: 0.84, limb: 0.78, reach: 1.16, head: 1.08 } },
];

export function generateMech(opts = {}) {
  const arch = ARCHETYPES.find((a) => a.id === (opts.archetype || "vanguard")) || ARCHETYPES[0];
  const p = arch.params;
  const rand = rng(((opts.seed ?? 1) >>> 0) * 2654435761 + 1);
  const accent = opts.accent || PALETTE.accent;
  const detail = opts.detail ?? 1.0;
  const { steel, dark, brass, glass, gun } = PALETTE;

  // PROPORTION: derive every coordinate from these so a canon change re-poses the
  // whole body coherently. U = overall scale, REACH = vertical stretch, W/H =
  // shoulder/hip spread (SILHOUETTE), LB = limb bulk (HIERARCHY/CONTRAST).
  const U = p.u, REACH = p.reach, LB = p.limb, HEAD = p.head;
  const W = p.shoulderW, H = p.hipW;
  const up = (x, y, z) => [x * W * U, y * REACH * U, z * U];   // upper-body frame
  const lo = (x, y, z) => [x * H * U, y * REACH * U, z * U];   // lower-body frame
  const ce = (x, y, z) => [x * U, y * REACH * U, z * U];       // centerline
  const jitter = (a) => (rand() - 0.5) * a;

  const nodes = [];
  const add = (type, pos, dims, o = {}) => nodes.push({
    type, pos, dims,
    rot: o.rot, op: o.op, k: o.k, sym: o.sym,
    round: o.round ?? 0.06, color: o.color ?? steel, stage: o.stage ?? 1,
  });

  // ===== STEP 1 — base shapes + connections (PRIMARY/SECONDARY masses) =====
  // torso: stacked cuboids, chest:abdomen heights ~ φ (PROPORTION)
  add("box", ce(0, 2.35, 0), [1.12 * U * W, 0.92 * U, 0.62 * U], { round: 0.1, color: steel });
  add("box", ce(0, 1.45, 0.02), [0.72 * U, 0.5 * U, 0.46 * U], { round: 0.08, color: dark });
  // neck tube (connection) + head, head a third smaller plays to HIERARCHY
  add("cyl", ce(0, 3.18, -0.02), [0.2 * U, 0.16 * U], { round: 0.04, color: dark });
  add("box", ce(0, 3.6, 0.04), [0.44 * U * HEAD, 0.36 * U * HEAD, 0.42 * U * HEAD], { round: 0.12, color: steel });
  // shoulders = ball joints (SYMMETRY via sym); arm chain: capsule, elbow, forearm
  add("sphere", up(1.26, 2.66, 0), [0.46 * U], { color: dark, sym: true });
  add("capsule", up(1.32, 1.96, 0), [0.23 * U * LB, 0.46 * U], { rot: [0, 0, 6], color: steel, sym: true });
  add("cyl", up(1.36, 1.4, 0), [0.21 * U * LB, 0.24 * U], { rot: [0, 0, 90], color: brass, sym: true });
  add("box", up(1.38, 0.92, 0.06), [0.27 * U * LB, 0.5 * U, 0.31 * U * LB], { round: 0.06, color: steel, sym: true });
  // pelvis + hip balls + leg chain (wider foot than knee = stable SILHOUETTE)
  add("box", ce(0, 0.86, 0), [0.82 * U * H, 0.42 * U, 0.52 * U], { round: 0.08, color: dark });
  add("sphere", lo(0.56, 0.66, 0), [0.31 * U], { color: brass, sym: true });
  add("capsule", lo(0.56, 0.02, 0), [0.27 * U * LB, 0.5 * U], { color: steel, sym: true });
  add("cyl", lo(0.56, -0.66, 0), [0.25 * U * LB, 0.27 * U], { rot: [0, 0, 90], color: brass, sym: true });
  add("box", lo(0.56, -1.36, 0.04), [0.29 * U * LB, 0.56 * U, 0.35 * U * LB], { round: 0.06, color: steel, sym: true });
  add("box", lo(0.56, -1.98, 0.2), [0.35 * U * LB, 0.18 * U, 0.56 * U], { round: 0.05, color: dark, sym: true });

  // ===== STEP 2 — modify: split / extrude / boolean subtract =================
  // SPLIT the chest into two plates with a center groove (boolean subtract)
  add("box", ce(0, 2.4, 0.2), [0.05 * U, 0.78 * U, 0.5 * U], { op: "subtract", color: dark, stage: 2 });
  // EXTRUDE a collar, then angular shoulder pads in ACCENT (FOCAL secondary)
  add("box", ce(0, 3.02, 0), [0.92 * U * W, 0.16 * U, 0.5 * U], { round: 0.06, color: dark, stage: 2 });
  add("box", up(1.4, 2.92, 0), [0.46 * U, 0.26 * U, 0.5 * U], { rot: [0, 0, -14], round: 0.12, color: accent, stage: 2, sym: true });
  // SUBTRACT the cockpit canopy then fill with glass — FOCAL POINT on upper third
  add("box", ce(0, 2.55, 0.55), [0.4 * U, 0.34 * U, 0.2 * U], { op: "subtract", stage: 2 });
  add("box", ce(0, 2.55, 0.5), [0.34 * U, 0.28 * U, 0.12 * U], { round: 0.05, color: glass, stage: 2 });
  // SUBTRACT a visor slot + glowing bar
  add("box", ce(0, 3.6 + 0.04, 0.42), [0.3 * U * HEAD, 0.08 * U, 0.12 * U], { op: "subtract", stage: 2 });
  add("box", ce(0, 3.64, 0.42), [0.26 * U * HEAD, 0.05 * U, 0.08 * U], { round: 0.02, color: glass, stage: 2 });
  // forearm cannon: barrel cylinder, then SUBTRACT the bore (CONTRAST: gun metal)
  add("cyl", up(1.38, 0.92, 0.62), [0.19 * U * LB, 0.42 * U], { rot: [90, 0, 0], round: 0.04, color: gun, stage: 2, sym: true });
  add("cyl", up(1.38, 0.92, 1.0), [0.1 * U, 0.3 * U], { rot: [90, 0, 0], op: "subtract", stage: 2, sym: true });
  // knee guard plate (extrude) in ACCENT
  add("box", lo(0.56, -0.66, 0.26), [0.24 * U, 0.3 * U, 0.16 * U], { round: 0.08, color: accent, stage: 2, sym: true });
  // toe split groove (subtract)
  add("box", lo(0.56, -1.98, 0.46), [0.37 * U * LB, 0.2 * U, 0.05 * U], { op: "subtract", stage: 2, sym: true });

  // ===== STEP 3 — micro detail: cut-lines / vents / bolts / antenna ==========
  // CONTRAST + RHYTHM. thigh cut-line (single seam)
  add("box", lo(0.56, 0.02, 0.27), [0.04 * U, 0.42 * U, 0.04 * U], { op: "subtract", stage: 3, sym: true });
  // RHYTHM: a run of shin vents on an even beat; count scales with detail density
  const vents = Math.max(1, Math.round(3 * detail));
  for (let i = 0; i < vents; i++) {
    const y = -1.3 - i * (0.4 / vents) - 0.02;
    add("box", lo(0.56, y, 0.4), [0.18 * U, 0.04 * U, 0.04 * U], { op: "subtract", stage: 3, sym: true });
  }
  // bolts on the shoulder pad (tertiary detail), seed-jittered so it isn't sterile
  add("cyl", up(1.55, 3.0, 0.36), [0.05 * U, 0.06 * U], { rot: [90, 0, 0], round: 0.02, color: brass, stage: 3, sym: true });
  add("cyl", up(1.25, 3.0, 0.36), [0.05 * U, 0.06 * U], { rot: [90, 0, 0], round: 0.02, color: brass, stage: 3, sym: true });
  // rivets along the collar
  add("sphere", ce(0.5 + jitter(0.04), 3.05, 0.46), [0.05 * U], { color: brass, stage: 3, sym: true });
  // abdomen panel seam (cut-line)
  add("box", ce(0, 1.7, 0.46), [0.6 * U, 0.03 * U, 0.04 * U], { op: "subtract", stage: 3 });
  // antenna — a thin vertical accent breaking the silhouette asymmetrically
  add("cyl", ce(0.32, 4.05, -0.08), [0.025 * U, 0.34 * U], { rot: [10, 0, 0], round: 0.01, color: accent, stage: 3, sym: true });

  // camera/ground framing derived from the canon so any archetype sits right
  const footBottom = (-1.98 * REACH - 0.18) * U;
  return {
    name: arch.name,
    archetype: arch.id,
    seed: opts.seed ?? 1,
    accent,
    detail,
    nodes,
    floorY: footBottom - 0.1,
    midY: 0.9 * REACH * U,
    dist: 9.5 * U * (0.85 + 0.2 * REACH),
  };
}
