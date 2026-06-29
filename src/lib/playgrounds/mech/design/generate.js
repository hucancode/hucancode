// MECH DESIGN ENGINE
// Fulfils the rig contract: walks the skeleton and DERIVES render primitives.
//   - each bone -> a limb solid (capsule / box / sphere by kind)
//   - each joint -> mechanical hardware whose SHAPE encodes its DOF:
//       1 yaw   -> a tube along the bone + a ring capping each end
//       2 pitch -> one cylinder crossing perpendicular (a hinge pin)
//       3 uni   -> a yaw ring + a perpendicular pitch cylinder through it
//       4 ball  -> a ball-and-socket sphere (+ socket lip)
// It knows design (shape, material, proportion-of-detail); it does NOT know how
// primitives are drawn, and it never reads back from the render engine.
//
// Principles still applied on top of the rig: limited PALETTE (unity), brass at
// every mechanism (legibility), accent + glass as the FOCAL point, bevels for
// CONTRAST of big smooth limbs vs small sharp hardware.

import { PALETTE } from "./palette.js";

const D2R = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const mul = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// euler (deg, our Rz*Ry*Rx convention) that rotates +Y onto unit dir d.
// derivation: with rz=0, column-1 of Ry*Rx = [sy*sx, cx, cy*sx]; match to d.
function eulerFromY(d) {
  const hyp = Math.hypot(d[0], d[2]);
  const rx = Math.atan2(hyp, d[1]) * D2R;
  const ry = Math.atan2(d[0], d[2]) * D2R;
  return [rx, ry, 0];
}

export function rigToPrimitives(rig, style = {}) {
  const { steel, dark, brass, glass } = PALETTE;
  const accent = style.accent || PALETTE.accent;
  const nodes = [];
  let curBone = -1; // which rig bone the current primitives belong to (for editor highlight)
  const add = (type, pos, dims, o = {}) => nodes.push({
    type, pos, dims,
    rot: o.rot, op: o.op, k: o.k, sym: o.sym,
    round: o.round ?? 0.04, color: o.color ?? steel, stage: o.stage ?? 1,
    _bone: curBone,
  });

  // ---- mechanical joint hardware, SHAPE == degrees of freedom --------------
  //   yaw spins about the bone direction `dir`; pitch spins about `pax` (the X
  //   pin). each rendered piece reads its allowed motion directly.
  function emitJoint(pos, type, dir, pax, r, sym) {
    if (type <= 0) return;                 // weld: no hardware
    const eDir = eulerFromY(dir);          // orient a part along the bone
    const ePax = eulerFromY(pax);          // orient a part along the pitch axis
    if (type === 4) {
      // BALL: sphere in the socket + a dark socket lip (torus) around it
      add("sphere", pos, [r * 0.95], { color: brass, round: 0, stage: 1, sym });
      add("torus", pos, [r * 1.0, r * 0.2], { rot: eDir, color: dark, stage: 2, sym });
      return;
    }
    if (type === 1) {
      // YAW: a tube ALONG the bone + a ring capping each end (twist about dir)
      add("cyl", pos, [r * 0.45, r * 1.3], { rot: eDir, color: brass, round: 0.03, stage: 1, sym });
      add("torus", addv(pos, mul(dir, r * 0.62)), [r * 0.78, r * 0.16], { rot: eDir, color: dark, stage: 2, sym });
      add("torus", addv(pos, mul(dir, -r * 0.62)), [r * 0.78, r * 0.16], { rot: eDir, color: dark, stage: 2, sym });
      return;
    }
    if (type === 2) {
      // PITCH: one cylinder crossing perpendicular to both parts (a hinge pin)
      add("cyl", pos, [r * 0.45, r * 2.0], { rot: ePax, color: brass, round: 0.03, stage: 1, sym });
      add("cyl", addv(pos, mul(pax, r * 1.0)), [r * 0.72, r * 0.12], { rot: ePax, color: dark, stage: 2, sym });
      add("cyl", addv(pos, mul(pax, -r * 1.0)), [r * 0.72, r * 0.12], { rot: ePax, color: dark, stage: 2, sym });
      return;
    }
    // UNI (2-axis): a yaw ring (normal = dir) with a perpendicular pitch pin
    // crossing through its centre.
    add("torus", pos, [r * 0.85, r * 0.18], { rot: eDir, color: dark, stage: 1, sym });
    add("cyl", pos, [r * 0.42, r * 1.7], { rot: ePax, color: brass, round: 0.03, stage: 2, sym });
  }

  // ---- limb solids, one shape per bone kind --------------------------------
  for (let bi = 0; bi < rig.bones.length; bi++) {
    const bone = rig.bones[bi];
    curBone = bi;
    const v = sub(bone.b, bone.a);
    const L = len(v) || 0.001;
    const dir = mul(v, 1 / L);
    const c = mid(bone.a, bone.b);
    const r = bone.radius;
    const rot = eulerFromY(dir);
    const sym = !!bone.sym;
    const jr = Math.max(r * 0.95, 0.05);

    if (bone.kind === "pelvis") {
      // cut-off upside-down pyramid: wide hips on top, narrow flat slot at the crotch.
      add("pyramid", c, [r * 0.6, L / 2, r * 1.05], { rot, round: 0.05, color: dark, sym, stage: 1 });
    } else if (bone.kind === "torso") {
      // cut-off upside-down pyramid: wide shoulders on top, narrow flat waist slot.
      add("pyramid", c, [r * 0.5, L / 2, r], { rot, round: 0.05, color: steel, sym, stage: 1 });
      // FOCAL: cockpit carved into the chest, glass fill (upper third)
      const ck = addv(c, [0, L * 0.28, r * 0.5]);
      add("box", ck, [r * 0.42, r * 0.42, r * 0.3], { op: "subtract", stage: 2 });
      add("box", addv(ck, [0, 0, -r * 0.06]), [r * 0.36, r * 0.34, r * 0.16], { round: 0.04, color: glass, stage: 2 });
      // BELLY: the torso<->pelvis connector, enlarged. there is no belly part, so
      // this oversized rounded connector plugs the waist slot and reads as one.
      add("sphere", bone.a, [r * 0.92], { color: steel, round: 0, sym, stage: 1 });
      add("torus", bone.a, [r * 0.7, r * 0.16], { rot, color: brass, stage: 2, sym }); // belly band, hints the 2-axis
    } else if (bone.kind === "head") {
      add("box", c, [r * 1.0, L / 2, r * 0.95], { round: 0.16, color: steel, sym, stage: 1 });
      const vz = addv(c, [0, 0, r * 0.85]);
      add("box", vz, [r * 0.7, r * 0.2, r * 0.3], { op: "subtract", stage: 2 });
      add("box", vz, [r * 0.6, r * 0.13, r * 0.16], { round: 0.03, color: glass, stage: 2 });
      // accent antenna breaking the silhouette
      add("cyl", addv(bone.b, [r * 0.7, r * 0.5, -r * 0.3]), [r * 0.07, r * 0.9], { rot: [12, 0, 0], color: accent, round: 0.01, stage: 3, sym: true });
    } else if (bone.kind === "shoulder") {
      // single box spanning torso end -> arm end; flat ends are the connector slots
      add("box", c, [r, L / 2 + r * 0.4, r * 0.85], { rot, round: 0.08, color: steel, sym, stage: 1 });
    } else if (bone.kind === "hip") {
      // single cylinder spanning pelvis end -> thigh end; flat caps are the slots
      add("cyl", c, [r * 0.9, L / 2 + r * 0.3], { rot, round: 0.06, color: dark, sym, stage: 1 });
    } else if (bone.kind === "hand") {
      add("box", c, [r, L / 2 + r * 0.2, r * 0.55], { rot, round: 0.05, color: steel, sym, stage: 1 });
    } else if (bone.kind === "foot") {
      add("box", c, [r * 0.95, r * 0.45, L / 2], { rot, round: 0.05, color: dark, sym, stage: 1 });
    } else if (bone.kind === "digit") {
      // cylinder = flat-capped slots at each knuckle
      add("cyl", c, [r, Math.max(0.02, L / 2)], { rot, round: 0.02, color: steel, sym, stage: 3 });
    } else if (/^(forearm|thigh|shin)/.test(bone.id)) {
      // cut-off upside-down pyramid: wide flat base (slot) at the proximal joint,
      // tapering to a smaller flat slot at the distal joint.
      add("pyramid", c, [r, L / 2, r * 0.5], { rot, round: 0.03, color: steel, sym, stage: 1 });
    } else {
      // generic limb (upper arm, etc.) = tapered cut-off cone, flat ends as slots
      add("cone", c, [r * 1.05, L / 2, r * 0.78], { rot, round: 0.03, color: steel, sym, stage: 1 });
    }

    // accent guard plate over the knee (the shin's hinge)
    if (bone.id === "shinL") {
      add("box", addv(bone.a, [0, 0, r * 1.0]), [r * 0.85, r * 1.1, r * 0.5], { round: 0.08, color: accent, stage: 2, sym });
    }

    // joint hardware at the proximal end. digits stay cheap: a single crossing
    // pin (pitch) regardless of DOF, so a hand isn't dozens of primitives.
    if (bone.kind === "digit") {
      if (bone.joint > 0) {
        const pax = bone.axis1 || [1, 0, 0];
        add("cyl", bone.a, [r * 1.05, r * 1.5], { rot: eulerFromY(pax), color: brass, round: 0.02, stage: 3, sym });
      }
    } else if (bone.kind !== "torso") {
      // torso's connector is the belly (emitted above), not standard joint hardware
      emitJoint(bone.a, bone.joint, dir, bone.axis1 || [1, 0, 0], jr, sym);
    }
  }

  return {
    nodes,
    floorY: rig.meta.floorY,
    midY: rig.meta.midY,
    dist: rig.meta.dist,
    archetype: rig.meta.archetype,
    name: rig.meta.name,
  };
}
