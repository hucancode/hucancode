import { m3Mul, m3MulV, m3Inv, m3AxisAngle, vScale } from "../math/mat3.js";
import { qFromM3, qToM3, qSlerp } from "../math/quat.js";
import { eases } from "../math/ease.js";
import { hash01, homingParams, simulateHoming, approachBlend, snapIn } from "./homing.js";

// ---- ASSEMBLY ANIMATION --------------------------------------------------------
// The dragon builds itself in FOUR phases, hierarchically: primitives belong
// to sub-assembly GROUPS (a part body or a joint block — the `group` tag on
// every item), groups belong to the dragon.
//   1. each primitive FLIES from a scatter point to a small standoff near its
//      seat in the group; the group is parked at its assembling spot, a far
//      offset along the assembly normal from its final seat
//   2. the primitive SNAPS into its seat — the group is formed
//   3. the formed group launches and HOMES on its moving mount point like a
//      missile (homing.js), entirely in WORLD space: fast turn-rate-clamped
//      seek toward a gate hovering off the mount normal, arriving ON the
//      gate FULLY ALIGNED with the live seat (position settled, rotation
//      matched, heading on the mount axis) — ready to land. The group banks
//      rigidly along its velocity (about its centroid) and levels out onto
//      the mount axis as it arrives
//   4. the aligned group SNAPS IN: a straight plug-in run down the live
//      mount normal, gate -> seat, orientation locked
// Group flights are re-simulated with fixed steps from launch on every call
// and all randomness is HASHED off group/item indices, so scrubbing the
// clock replays the exact same build. Distances are RIG UNITS, phase times
// are fractions of the whole build (u in 0..1).
export const ASSEMBLY = {
  gSpan: 0.45,             // group start stagger (chain-ordered, head first)
  pSpan: 0.08,             // primitive stagger within its group
  pJit: 0.03,              // hashed extra primitive delay
  fly: 0.15,               // phase 1 duration (prim flight)
  snap2: 0.05,             // phase 2 duration (prim snap into group)
  travel: 0.19,            // phases 3+4 duration (group homing flight + snap-in)
  approach: 0.72,          // fraction of travel spent flying to the gate (rest = snap-in)
  align: 0.8,              // rotation fully matches the live seat by this fraction of the approach
  fadeIn: 0.15,            // fraction of the prim flight spent fading it in
  scatter: [12, 24],       // prim start distance from its target
  standoff: [0.5, 1.0],    // prim pre-snap standoff distance
  gOff: [3.6, 8.4],        // group assembling offset along the normal (far)
  revs: [0.75, 1.75],      // prim self-spin during flight, revolutions
  dock: [1.2, 2.8],        // gate standoff = snap-in run length along the mount normal
  speed: [1.6, 2.2],       // homing speed, fraction of the parked distance per approach
  turn: [8, 12],           // homing turn rate, radians per approach
  kick: [0.35, 0.8],       // launch kick: lateral mix (rest goes outward)
  capture: 0.18,           // fraction of the approach spent settling onto the gate
  steps: 96,               // fixed integration steps per flight (determinism grid)
};

const Q_ID = [0, 0, 0, 1];

// first-seen group registration + seat-centroid accumulation, shared by
// poseGroups and assembleModel's pass 1 (both walk items in the same order,
// so group indices always line up). Optional hooks let pass 1 fill its extra
// per-group / per-item tables in the same sweep without extra allocations:
// onNew(gi, item, i) fires when a group is first seen, onItem(gi, pi, i) on
// every item (pi = the item's index within its group).
function groupCentroids(arr, onNew = null, onItem = null) {
  const reg = new Map(), cen = [], cnt = [];
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    let gi = reg.get(it.group);
    if (gi === undefined) {
      gi = reg.size; reg.set(it.group, gi);
      cen.push([0, 0, 0]); cnt.push(0);
      if (onNew) onNew(gi, it, i);
    }
    if (onItem) onItem(gi, cnt[gi], i);
    const c = cen[gi];
    c[0] += it.t[0]; c[1] += it.t[1]; c[2] += it.t[2]; cnt[gi]++;
  }
  for (let gi = 0; gi < cen.length; gi++) cen[gi] = vScale(cen[gi], 1 / cnt[gi]);
  return { reg, cen, cnt };
}

// group seat centroids + assembly normals of a pose (same first-seen group
// order as assembleModel's pass 1). Cached per item-array identity: callers
// cache their ref poses, so each sampled pose is reduced exactly once.
const poseCache = new WeakMap();
function poseGroups(arr) {
  let e = poseCache.get(arr);
  if (e) return e;
  const an = [];
  const { cen } = groupCentroids(arr, (gi, it) => an.push(it.an));
  e = { cen, an };
  poseCache.set(arr, e);
  return e;
}

// quantize a ref-sample time to a 1/64 grid so a whole build touches at most
// ~64 distinct poses — the callers' ref caches absorb the rest
const quant64 = (uu) => Math.round(uu * 64) / 64;

// Animate a dragonModel() item list at build progress u (0 = nothing placed,
// 1 = fully assembled). Returns a NEW item list: items not yet spawned are
// dropped, moving items get displaced m/t and an alpha `a`.
//
// `refFn` (optional) = the ride sampled over build progress, in WORLD space:
// a function (uStart) -> same-order item list, the pose at that progress.
// Phases 1-2 anchor on it (groups form at fixed spots instead of chasing the
// moving body) and the homing flight aims at it (the mount point at each
// moment of the flight). Without it the live items are their own base
// (static body).
export function assembleModel(items, u, refFn = null) {
  if (u >= 1) return items;
  if (u <= 0) return [];
  const A = ASSEMBLY;

  // ---- pass 1: group the items (first-seen order, stable per build).
  // `depth` = skeleton chain depth (head/root = 0), pose-independent — the
  // build follows the chain, head first. gCen = live seat centroids
  const gOf = new Int32Array(items.length), pOf = new Int32Array(items.length);
  const gDepth = [], gFirst = [];
  const { reg, cen: gCen, cnt: counts } = groupCentroids(
    items,
    (gi, it, i) => { gDepth.push(it.depth); gFirst.push(i); },
    (gi, pi, i) => { gOf[i] = gi; pOf[i] = pi; },
  );
  const nG = reg.size;
  const maxDepth = Math.max(1, ...gDepth);

  // ---- pass 2: per-group clock + frozen anchor pose. Chain-ordered stagger:
  // same-depth groups (a link's body + its joints, mirrored limbs) start
  // together, children start after their parent link. `anW` = the assembly
  // normal (rig tags it off the link's mating slot) in the anchor pose
  const gd = [], gDone = [], gRef = [], gAnW = [], gFar = [];
  for (let gi = 0; gi < nG; gi++) {
    gd.push((gDepth[gi] / maxDepth) * A.gSpan);
    gDone.push(gd[gi] + A.pSpan + A.pJit + A.fly + A.snap2);  // group formed
    gRef.push(refFn ? refFn(gd[gi]) : null);
    const h = gRef[gi]?.[gFirst[gi]] ?? items[gFirst[gi]];
    gAnW.push(h.an);
    gFar.push(A.gOff[0] + (A.gOff[1] - A.gOff[0]) * hash01(gi, 22));
  }

  // ---- pass 3: flight state, all WORLD space. The parked centroid (anchor
  // pose) is the launch pad; the homing integrator chases the gate off the
  // mount point sampled along the ride; the arrival blend and the snap-in
  // run target the LIVE pose so the landing is exact no matter how the body
  // moved. `gBank` = rigid velocity alignment: the minimal rotation taking
  // the plug axis (-n) onto the current flight direction, eased in over the
  // approach — the group noses along its trajectory and levels onto the
  // mount axis as it arrives at the gate; through the snap-in dir === -n so
  // the bank is already identity.
  const gPos = [], gRot = [], gBank = [], gSeated = [], gCenA = [];
  for (let gi = 0; gi < nG; gi++) gCenA.push([0, 0, 0]);
  for (let i = 0; i < items.length; i++) {           // parked (anchor) centroids
    const gi = gOf[i];
    if (u <= gDone[gi]) continue;
    const a = gRef[gi]?.[i] ?? items[i];
    const ca = gCenA[gi];
    ca[0] += a.t[0]; ca[1] += a.t[1]; ca[2] += a.t[2];
  }
  for (let gi = 0; gi < nG; gi++) {
    const p3 = (u - gDone[gi]) / A.travel;
    if (p3 <= 0 || p3 >= 1) {                        // parked or seated: no sim
      gPos.push(null); gRot.push(0); gBank.push(null); gSeated.push(p3 >= 1);
      continue;
    }
    gSeated.push(false);
    gCenA[gi] = vScale(gCenA[gi], 1 / counts[gi]);
    const nLive = items[gFirst[gi]].an;
    const [ax, ay, az] = gAnW[gi];
    const from = [
      gCenA[gi][0] + ax * gFar[gi],
      gCenA[gi][1] + ay * gFar[gi],
      gCenA[gi][2] + az * gFar[gi],
    ];
    const P = homingParams(gi, gFar[gi], A);
    const t0 = gDone[gi], tw = A.travel;
    const aimAt = refFn
      ? (tk) => {
          const pose = poseGroups(refFn(quant64(t0 + tk * tw)));
          return { seat: pose.cen[gi], n: pose.an[gi] };
        }
      : () => ({ seat: gCen[gi], n: nLive });
    let p, dir;
    if (p3 < P.approach) {                           // phase 3: fly to the gate
      const sim = simulateHoming(from, gAnW[gi], p3, P, aimAt);
      ({ p, dir } = approachBlend(sim, gCen[gi], nLive, p3, P));
    } else {                                         // phase 4: snap in along the normal
      ({ p, dir } = snapIn(gCen[gi], nLive, p3, P));
    }
    const rot = eases.inOutCubic(Math.min(1, p3 / (A.align * A.approach)));
    gPos.push(p);
    gRot.push(rot);
    const cx = -nLive[1] * dir[2] + nLive[2] * dir[1];  // cross(-n, dir)
    const cy = -nLive[2] * dir[0] + nLive[0] * dir[2];
    const cz = -nLive[0] * dir[1] + nLive[1] * dir[0];
    const sl = Math.hypot(cx, cy, cz);
    const dt = -(nLive[0] * dir[0] + nLive[1] * dir[1] + nLive[2] * dir[2]);
    gBank.push(sl > 1e-4
      ? m3AxisAngle(cx / sl, cy / sl, cz / sl, Math.atan2(sl, dt) * rot)
      : null);
  }

  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const gi = gOf[i];
    if (gSeated[gi]) { out.push({ ...it, a: 1 }); continue; }  // flight done
    const base = gRef[gi]?.[i] ?? it;                // WORLD transform source (phases 1-2)
    const cnt = counts[gi];
    const pFrac = cnt > 1 ? pOf[i] / (cnt - 1) : 0;
    const pt = u - gd[gi] - pFrac * A.pSpan - hash01(i, 1) * A.pJit;
    if (pt <= 0) continue;                           // not spawned yet

    // ---- group position: parked FAR out on its approach line in WORLD
    // space (frozen anchor pose) while the prims assemble it (phases 1-2);
    // once formed it homes on the live mount (position precomputed per
    // group above): item offsets settle from the parked arrangement to the
    // live seats and rotate with the group's bank about the centroid —
    // rigid at both ends, no frame jump, no snap.
    const [wx, wy, wz] = gAnW[gi];
    const far = gFar[gi];
    const P3 = gPos[gi];
    let tr, phase34 = 0;                             // rotation blend base -> live
    if (P3) {
      const C = gCen[gi], CA = gCenA[gi];
      const oax = base.t[0] - CA[0], oay = base.t[1] - CA[1], oaz = base.t[2] - CA[2];
      const k34 = gRot[gi];
      const o = [                                    // parked -> live offset settle
        oax + (it.t[0] - C[0] - oax) * k34,
        oay + (it.t[1] - C[1] - oay) * k34,
        oaz + (it.t[2] - C[2] - oaz) * k34,
      ];
      const ro = gBank[gi] ? m3MulV(gBank[gi], o) : o;
      tr = [P3[0] + ro[0], P3[1] + ro[1], P3[2] + ro[2]];
      phase34 = k34;
    } else {
      tr = [base.t[0] + wx * far, base.t[1] + wy * far, base.t[2] + wz * far];
    }

    // ---- primitive offset within the group (phases 1-2): scatter-fly to a
    // standoff near its seat, then snap in
    let m = base.m, a = 1, dist = 0;
    if (pt < A.fly) {                                // phase 1: fly in
      const fp = eases.inOutCubic(pt / A.fly);
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
      dist = off * (1 - eases.outBack((pt - A.fly) / A.snap2));
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
    // rotation during the flight: settle from the formed (anchor-pose)
    // orientation to the seat orientation, then bank the result along the
    // velocity — the bank unwinds to identity as the arrival levels the
    // heading onto the mount axis, so the group reaches the gate exactly in
    // its seat pose and the snap-in carries it straight down the normal.
    // The settle slerps the PURE rotation delta base -> live on
    // the quaternion sphere (the item's local scale cancels through the
    // inverse) — a component-wise matrix lerp would shear the group.
    if (phase34 > 0) {
      if (m !== it.m) {
        if (phase34 >= 1) m = it.m;
        else {
          const dq = qFromM3(m3Mul(it.m, m3Inv(m)));
          m = m3Mul(qToM3(qSlerp(Q_ID, dq, phase34)), m);
        }
      }
      if (gBank[gi]) m = m3Mul(gBank[gi], m);
    }
    out.push({ ...it, m, t: tr, a });
  }
  return out;
}
