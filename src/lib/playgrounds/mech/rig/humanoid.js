// RIG ENGINE
// Produces a mechanical SKELETON: a tree of bones (a part = a bone segment) and,
// at each bone's proximal end, the joint that connects it to its parent. The rig
// knows anatomy + mechanics ONLY — part positions/sizes and joint TYPE. It emits
// no primitives and no colors; the design engine derives those from this contract.
//
// Joint types (all ROTATIONAL — no sliding). The 1-axis case splits in two
// because mechanics (and rendered hardware) differ by which axis spins:
//   0  weld    rigid, no DOF
//   1  yaw     1 axis along the bone normal       -> tube + a ring on each end
//   2  pitch   1 axis perpendicular (the X pin)   -> one crossing cylinder
//   3  uni     2 axes (yaw + pitch)               -> yaw ring + crossing cylinder
//   4  ball    3 axes                             -> ball-and-socket sphere
//
// Bilateral symmetry: lateral bones are authored once on +X with sym:true; the
// render engine mirrors them, so the rig only states half the body.
//
// Bone: { id, parent, kind, a:[x,y,z], b:[x,y,z], radius, joint, axis1, sym }
//   a = proximal joint position, b = distal end. yaw spins about the bone's own
//   direction (derived from a,b); axis1 = the perpendicular pitch axis (unit,
//   default X). length/dir derive from a,b.

// archetype = a proportion canon. these drive part placement + size, nothing else.
export const ARCHETYPES = [
  { id: "vanguard", name: "Vanguard (heroic)", params: { u: 1.0, reach: 1.0, limb: 1.0, spread: 1.0, head: 1.0 } },
  { id: "titan", name: "Titan (heavy)", params: { u: 1.12, reach: 0.92, limb: 1.4, spread: 1.2, head: 0.85 } },
  { id: "scout", name: "Scout (light)", params: { u: 0.92, reach: 1.16, limb: 0.78, spread: 0.9, head: 1.08 } },
];

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const add3 = (p, d, L) => [p[0] + d[0] * L, p[1] + d[1] * L, p[2] + d[2] * L];

export function buildHumanoidRig(opts = {}) {
  const arch = ARCHETYPES.find((a) => a.id === (opts.archetype || "vanguard")) || ARCHETYPES[0];
  const P = arch.params;
  const withFingers = opts.fingers !== false;
  const bones = [];

  // author in nominal units, then scale: x by spread, y by reach, all by u; radius
  // by u*limb. one place to re-cast the whole canon.
  const sx = P.spread * P.u, sy = P.reach * P.u, sz = P.u;
  const sc = (p) => [p[0] * sx, p[1] * sy, p[2] * sz];
  const sr = (r) => r * P.u * P.limb;
  const B = (b) => {
    bones.push({ ...b, a: sc(b.a), b: sc(b.b), radius: sr(b.radius), axis1: b.axis1 || X });
  };

  // ===== CORE (centerline, not mirrored) =================================
  // pelvis is the root. y measured from the pelvis floor.
  B({ id: "pelvis", parent: null, kind: "pelvis", a: [0, 0.0, 0], b: [0, 0.5, 0], radius: 0.5, joint: 0 });
  // torso -> pelvis: 2-axis (lean fwd/back + turn)
  B({ id: "torso", parent: "pelvis", kind: "torso", a: [0, 0.5, 0], b: [0, 2.1, 0], radius: 0.56, joint: 3, axis1: X });
  // head -> neck: 2-axis (nod + turn)
  B({ id: "head", parent: "torso", kind: "head", a: [0, 2.25, 0], b: [0, 2.95, 0.02], radius: 0.42 * P.head, joint: 3, axis1: X });

  // ===== ARMS (mirrored) =================================================
  // shoulder = a 90deg angled bracket: torso end (a) bolts to the torso, arm end
  // (b) carries the arm. The torso->shoulder joint is the 2-axis (uni) pivot, so
  // the whole arm assembly swings as one; the arm then welds to the bracket end.
  B({ id: "shoulderL", parent: "torso", kind: "shoulder", a: [0.46, 1.62, 0], b: [0.92, 2.0, 0], radius: 0.24, joint: 3, axis1: X, sym: true });
  // elbow + wrist are 2-axis (uni); shoulder pivot lives on the bracket above.
  B({ id: "armL", parent: "shoulderL", kind: "limb", a: [0.92, 2.0, 0], b: [0.99, 1.12, 0], radius: 0.22, joint: 0, sym: true });
  B({ id: "forearmL", parent: "armL", kind: "limb", a: [0.99, 1.12, 0], b: [1.04, 0.42, 0.02], radius: 0.19, joint: 3, axis1: X, sym: true });
  B({ id: "handL", parent: "forearmL", kind: "hand", a: [1.04, 0.42, 0.02], b: [1.05, 0.12, 0.04], radius: 0.17, joint: 3, axis1: X, sym: true });

  // ===== LEGS (mirrored) =================================================
  // hip = a 90deg angled bracket (same principle as the shoulder): pelvis end (a)
  // bolts to the pelvis on the 3-axis ball pivot, thigh end (b) carries the leg;
  // thigh welds to the bracket. knee = 2-axis; ankle = 1-axis pitch.
  B({ id: "hipL", parent: "pelvis", kind: "hip", a: [0.18, 0.18, 0], b: [0.5, -0.12, 0], radius: 0.3, joint: 4, sym: true });
  B({ id: "thighL", parent: "hipL", kind: "limb", a: [0.5, -0.12, 0], b: [0.52, -1.05, 0], radius: 0.27, joint: 0, sym: true });
  B({ id: "shinL", parent: "thighL", kind: "limb", a: [0.52, -1.05, 0], b: [0.54, -1.95, 0], radius: 0.23, joint: 3, axis1: X, sym: true });
  B({ id: "footL", parent: "shinL", kind: "foot", a: [0.54, -1.95, -0.05], b: [0.54, -2.08, 0.42], radius: 0.18, joint: 2, axis1: X, sym: true });

  // ===== HANDS: 2 fingers (3 digits) + thumb (2 digits) = 3 digits ========
  if (withFingers) {
    const palm = [1.05, 0.12, 0.04];
    // 2 fingers, spread across the palm in X, point -Y with a slight forward fan.
    const fingerXs = [-0.07, 0.07];
    fingerXs.forEach((dx, fi) => {
      let prev = "handL";
      let p = [palm[0] + dx, palm[1] - 0.02, palm[2] + 0.06];
      const dir = [dx * 0.4, -1, 0.18];
      const dl = Math.hypot(dir[0], dir[1], dir[2]);
      const u = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
      for (let s = 0; s < 3; s++) {
        const seg = 0.13 - s * 0.02;
        const nb = add3(p, u, seg);
        // hand->finger and digit->digit are all 1-axis pitch hinges.
        B({ id: `f${fi}_${s}L`, parent: prev, kind: "digit", a: p, b: nb,
          radius: 0.052, joint: 2, axis1: X, sym: true });
        prev = `f${fi}_${s}L`; p = nb;
      }
    });
    // thumb: 2 digits, inner side, angled out + forward. hand->thumb = 2-axis,
    // then digit->digit = 1-axis pitch.
    let prev = "handL";
    let p = [palm[0] - 0.13, palm[1] + 0.16, palm[2] + 0.05];
    const dir = [-0.5, -0.7, 0.5];
    const dl = Math.hypot(dir[0], dir[1], dir[2]);
    const u = [dir[0] / dl, dir[1] / dl, dir[2] / dl];
    for (let s = 0; s < 2; s++) {
      const nb = add3(p, u, 0.13);
      B({ id: `th_${s}L`, parent: prev, kind: "digit", a: p, b: nb,
        radius: 0.058, joint: s === 0 ? 3 : 2, axis1: Z, sym: true });
      prev = `th_${s}L`; p = nb;
    }
  }

  // framing derived from the canon so any archetype is well-composed
  const footBottom = -2.08 * sy;
  const meta = {
    archetype: arch.id,
    name: arch.name,
    floorY: footBottom - 0.1,
    midY: 0.9 * sy,
    dist: 9.5 * P.u * (0.85 + 0.2 * P.reach),
  };
  return { bones, meta };
}
