import { m3Mul } from "./rig.js";

// ---- ASSEMBLY ANIMATION --------------------------------------------------------
// The dragon builds itself in FOUR phases, hierarchically: primitives belong
// to sub-assembly GROUPS (a part body or a joint block — the `group` tag on
// every item), groups belong to the dragon.
//   1. each primitive FLIES from a scatter point to a small standoff near its
//      seat in the group; the group is parked at its assembling spot, a far
//      offset along the assembly normal from its final seat
//   2. the primitive SNAPS into its seat — the group is formed
//   3. the formed group flies down its approach line to a near-final offset
//   4. the group SNAPS into its final seat (overshoot ease) — dragon grows
// Everything rides the LIVE body: offsets are relative to the current frame's
// item transforms, along the current assembly normal. Each group gets a time
// offset (skeleton chain order, head first), each primitive within a group
// another. All randomness is HASHED off group/item indices so scrubbing the
// clock replays the exact same build. Distances are RIG UNITS, phase times
// are fractions of the whole build (u in 0..1).
export const ASSEMBLY = {
  gSpan: 0.45,             // group start stagger (chain-ordered, head first)
  pSpan: 0.08,             // primitive stagger within its group
  pJit: 0.03,              // hashed extra primitive delay
  fly: 0.15,               // phase 1 duration (prim flight)
  snap2: 0.05,             // phase 2 duration (prim snap into group)
  fly3: 0.12,              // phase 3 duration (group far -> near flight)
  snap4: 0.07,             // phase 4 duration (group snap into the dragon)
  fadeIn: 0.15,            // fraction of the prim flight spent fading it in
  scatter: [12, 24],       // prim start distance from its target
  standoff: [0.5, 1.0],    // prim pre-snap standoff distance
  gOff: [3.6, 8.4],        // group assembling offset along the normal (far)
  gNear: [1.2, 2.8],       // group near-final offset before the snap
  revs: [0.75, 1.75],      // prim self-spin during flight, revolutions
};

// deterministic per-index random in [0,1)
function hash01(i, salt) {
  let h = (Math.imul(i, 374761393) + Math.imul(salt, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

function m3AxisAngle(ax, ay, az, t) {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [
    ax * ax * k + c, ax * ay * k - az * s, ax * az * k + ay * s,
    ay * ax * k + az * s, ay * ay * k + c, ay * az * k - ax * s,
    az * ax * k - ay * s, az * ay * k + ax * s, az * az * k + c,
  ];
}

// hashed fallback direction for item lists without rig `an` tags
function hashDir(gi) {
  const az = Math.PI * 2 * hash01(gi, 20);
  const y = 0.1 + 0.6 * hash01(gi, 21);
  const s = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(az) * s, y, Math.sin(az) * s];
}

// Animate a dragonModel() item list at build progress u (0 = nothing placed,
// 1 = fully assembled). Returns a NEW item list: items not yet spawned are
// dropped, moving items get displaced m/t and an alpha `a`.
//
// `ref` (optional) = WORLD anchors for phases 1-2, so groups assemble at
// fixed spots instead of chasing the moving body. Two forms:
//   - function (uStart) -> same-order item list: the ride sampled at build
//     progress uStart. Each group anchors on the pose at ITS OWN start —
//     where the body was when the group began forming.
//   - array: one frozen pose for the whole build.
// Without ref the live items are their own base (everything tracks the body).
export function assembleModel(items, u, ref = null) {
  if (u >= 1) return items;
  if (u <= 0) return [];
  const A = ASSEMBLY;
  const refFn = typeof ref === "function" ? ref : ref ? () => ref : null;

  // ---- pass 1: group the items (first-seen order, stable per build).
  // `depth` = skeleton chain depth (head/root = 0), pose-independent — the
  // build follows the chain, head first
  const reg = new Map();
  const gOf = new Int32Array(items.length), pOf = new Int32Array(items.length);
  const counts = [], gDepth = [], gFirst = [];
  items.forEach((it, i) => {
    let gi = reg.get(it.group);
    if (gi === undefined) {
      gi = reg.size; reg.set(it.group, gi); counts.push(0);
      gDepth.push(it.depth ?? gi); gFirst.push(i);
    }
    gOf[i] = gi; pOf[i] = counts[gi]++;
  });
  const nG = reg.size;
  const maxDepth = Math.max(1, ...gDepth);

  // ---- pass 2: per-group clock + frozen anchor pose. Chain-ordered stagger:
  // same-depth groups (a link's body + its joints, mirrored limbs) start
  // together, children start after their parent link. `anW` = the assembly
  // normal (rig tags it off the link's mating slot) in the anchor pose
  const gd = [], gDone = [], gRef = [], gAnW = [];
  for (let gi = 0; gi < nG; gi++) {
    gd.push((gDepth[gi] / maxDepth) * A.gSpan);
    gDone.push(gd[gi] + A.pSpan + A.pJit + A.fly + A.snap2);  // group formed
    gRef.push(refFn ? refFn(gd[gi]) : null);
    const h = gRef[gi]?.[gFirst[gi]] ?? items[gFirst[gi]];
    gAnW.push(h.an ?? hashDir(gi));
  }

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const gi = gOf[i];
    const base = gRef[gi]?.[i] ?? it;                // WORLD transform source (phases 1-2)
    const cnt = counts[gi];
    const pFrac = cnt > 1 ? pOf[i] / (cnt - 1) : 0;
    const pt = u - gd[gi] - pFrac * A.pSpan - hash01(i, 1) * A.pJit;
    if (pt <= 0) continue;                           // not spawned yet

    // ---- group position: parked FAR out on its approach line in WORLD
    // space (frozen anchor pose) while the prims assemble it (phases 1-2);
    // then it converts to DRAGON LOCAL coordinates — flies to a near-final
    // offset riding the live body (phase 3) and snaps into the seat with a
    // slight overshoot (phase 4)
    const [wx, wy, wz] = gAnW[gi];
    const far = A.gOff[0] + (A.gOff[1] - A.gOff[0]) * hash01(gi, 22);
    const nearL = A.gNear[0] + (A.gNear[1] - A.gNear[0]) * hash01(gi, 25);
    const tr = [base.t[0] + wx * far, base.t[1] + wy * far, base.t[2] + wz * far];
    const p3 = (u - gDone[gi]) / A.fly3;
    let phase34 = 0;                                 // rotation blend base -> live
    if (p3 > 0) {
      const [lx, ly, lz] = it.an ?? hashDir(gi);
      const s4p = (u - gDone[gi] - A.fly3) / A.snap4;
      if (s4p > 0) {                                 // phase 4: local snap, overshoot
        const gl = nearL * (1 - easeOutBack(Math.min(1, s4p)));
        tr[0] = it.t[0] + lx * gl; tr[1] = it.t[1] + ly * gl; tr[2] = it.t[2] + lz * gl;
        phase34 = 1;
      } else {                                       // phase 3: world -> local flight
        const e3 = easeInOutCubic(p3);
        tr[0] += (it.t[0] + lx * nearL - tr[0]) * e3;
        tr[1] += (it.t[1] + ly * nearL - tr[1]) * e3;
        tr[2] += (it.t[2] + lz * nearL - tr[2]) * e3;
        phase34 = e3;
      }
    }

    // ---- primitive offset within the group (phases 1-2): scatter-fly to a
    // standoff near its seat, then snap in
    let m = base.m, a = 1, dist = 0;
    if (pt < A.fly) {                                // phase 1: fly in
      const fp = easeInOutCubic(pt / A.fly);
      const r0 = A.scatter[0] + (A.scatter[1] - A.scatter[0]) * hash01(i, 4);
      const off = A.standoff[0] + (A.standoff[1] - A.standoff[0]) * hash01(i, 5);
      dist = off + (r0 - off) * (1 - fp);
      // self-spin unwinds to 0 exactly when the flight ends
      const revs = (hash01(i, 6) < 0.5 ? -1 : 1) *
        (A.revs[0] + (A.revs[1] - A.revs[0]) * hash01(i, 7));
      const ang = revs * 2 * Math.PI * (1 - fp);
      const axY = 2 * hash01(i, 8) - 1, axS = Math.sqrt(Math.max(0, 1 - axY * axY));
      const axA = Math.PI * 2 * hash01(i, 9);
      m = m3Mul(m3AxisAngle(Math.cos(axA) * axS, axY, Math.sin(axA) * axS, ang), m);
      a = Math.min(1, pt / (A.fly * A.fadeIn));
    } else if (pt < A.fly + A.snap2) {               // phase 2: snap into the group
      const off = A.standoff[0] + (A.standoff[1] - A.standoff[0]) * hash01(i, 5);
      dist = off * (1 - easeOutBack((pt - A.fly) / A.snap2));
    }
    if (dist !== 0) {
      // scatter direction: deterministic, mostly from above (rig is y-up)
      const saz = Math.PI * 2 * hash01(i, 2);
      const dy = 0.25 + 0.7 * hash01(i, 3);
      const s = Math.sqrt(Math.max(0, 1 - dy * dy));
      tr[0] += Math.cos(saz) * s * dist;
      tr[1] += dy * dist;
      tr[2] += Math.sin(saz) * s * dist;
    }
    // rotation follows the world -> local handoff (phases 3-4)
    if (phase34 > 0 && m !== it.m)
      m = phase34 >= 1 ? it.m : m.map((v, k) => v + (it.m[k] - v) * phase34);
    out.push({ ...it, m, t: tr, a });
  }
  return out;
}
