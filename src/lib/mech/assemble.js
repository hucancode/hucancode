// ASSEMBLE ENGINE — turns PARTS + JOINTS + BONES into a figure, and the only
// file that knows all three exist (parts model bodies, joints model joints,
// skeleton spins bones; none of them import each other). A rig is then pure data
// — a table of links — plus whatever it does with the bones (the dragon solves
// its spine off a curve, the atlas just reads pose sliders).
//
// A part is a BODY with SLOTS. A slot is a bolting FACE { pos, n, f } — origin,
// outward normal, forward tangent. A slot carrying `joint: { kind, p }` OFFERS
// that joint to a child, and the part owns its FEMALE half there; a part's
// `mount` slot is the plain face where its own MALE half bolts on. So no part
// ever models a joint half itself.
//
// A link says: this part, mounted on that parent's slot —
//   { name, part, params?, parent, at, slot?, angles?, flip? }
// and the joint between them comes off the PARENT's slot, one declaration, so
// the halves can never drift apart. The engine then seats the joint (mount `a`
// onto the parent's slot), spends exactly the bones its DOF list asks for on its
// axes of motion, rides each piece of geometry on the bone it belongs to, and
// BAKES all of it once — per frame it only resolves bones and composes matrices.
//
// A rig's pose sliders reach the bones through `angles`, aligned with the
// joint's DOF list; a rig may also drive `bones` directly.
//
// NO MIRRORING, deliberately: mirroring a slot is a REFLECTION and a joint can
// only be seated by a ROTATION, so a reflected frame would flip the joint's
// handedness. A symmetric figure gives its right-hand slot the REVERSED pin (f)
// — what a mirrored clevis physically is — and the rig flips that side's signs.
import { bake, meshOf } from "./primitives.js";
import { colorMemo } from "./color.js";
import { jointSpec } from "./joints.js";
import { createSkeleton } from "./skeleton.js";
import {
  I3, vAdd, vSub, vScale, vNorm, vCross, m3Mul, m3MulV, m3T, m3Rot,
} from "../math/mat3.js";

// ---- SLOT MATCHING ---------------------------------------------------------
// a slot { pos, n, f } is a full coordinate system: columns [f, n×f, n]
const slotFrame = (s) => {
  const f = vNorm(s.f), n = vNorm(s.n), b = vCross(n, f);
  return [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
};

// the rotation seating a child slot against a parent slot: positions coincide
// (the caller supplies the offset), forwards ALIGN, normals OPPOSE
export const matchRot = (parent, child) => {
  const f = vNorm(parent.f), n = vScale(vNorm(parent.n), -1);
  const b = vCross(n, f);
  const target = [f[0], b[0], n[0], f[1], b[1], n[1], f[2], b[2], n[2]];
  return m3Mul(target, m3T(slotFrame(child)));
};

// ---- ASSEMBLY --------------------------------------------------------------

const EULER = ["x", "y", "z"];

// Seat a joint's female base onto a slot, in the frame the slot's OWNER rides
// (its part is itself bolted in at an angle — `ownerR` / `ownerT`). The slot
// receives either the joint's base FACE (default, so a part never computes how
// deep a joint reaches) or the joint's AXIS itself (`anchor: "axis"`, for a part
// modeled around a bare pin: the dragon's jaw, a finger knuckle).
function seatJoint(slot, mountA, ownerR, ownerT) {
  const R0 = matchRot(slot, mountA);                        // joint frame -> owner PART frame
  const org0 = slot.anchor === "axis"
    ? [...slot.pos]
    : vSub(slot.pos, m3MulV(R0, mountA.pos));
  return { r: m3Mul(ownerR, R0), t: vAdd(m3MulV(ownerR, org0), ownerT) };
}

export function createAssembly({ kit, links, seed = 1, root = [0, 0, 0] }) {
  const colorFor = colorMemo(seed);
  const sk = createSkeleton();

  // --- compile the links: slots, parent lookups, chain depth ---
  const L = links.map((d) => ({ ...d }));
  const byName = {};
  for (const d of L) {
    const par = d.parent ? byName[d.parent] : null;
    if (d.parent && !par) throw new Error(`${d.name}: parent "${d.parent}" not declared before it`);
    d.par = par;
    d.depth = par ? par.depth + 1 : 0;
    d.slots = kit.partSlots(d.part, d.params ?? null);
    // the part's own bolting face: what it hangs from (a root names it `pivot`)
    d.slot0 = d.slots[par ? (d.slot ?? "mount") : (d.pivot ?? d.slot ?? "mount")];
    if (!d.slot0) throw new Error(`${d.name}: no mount slot on part "${d.part}"`);
    byName[d.name] = d;
  }

  // --- bones + geometry, both baked ONCE. `chunks` = the finished figure:
  // every primitive, the bone it rides and the local transform it rides with ---
  const chunks = [];                                 // { bone, group, prims: [{key,m,t,color}] }
  const emitTo = (bone, group, build) => {
    const prims = [];
    build((g) => {
      const b = bake(g);
      prims.push({ key: b.key, m: b.m, t: b.t, color: colorFor(b.id) });
    });
    if (prims.length) chunks.push({ bone, group, prims });
    return prims;
  };
  // fold a local transform into an already-baked chunk (parts and female halves
  // are authored in their own frame, then bolted into the bone's frame)
  const seat = (prims, r, t) => {
    for (const p of prims) {
      p.m = m3Mul(r, p.m);
      p.t = vAdd(m3MulV(r, p.t), t);
    }
    return prims;
  };

  for (const d of L) {
    const par = d.par;
    if (!par) {
      // ROOT: one free bone at the root offset — the rig places and turns the
      // whole figure through it
      d.ids = [sk.add(`${d.name}.root`, -1, [...root], "free")];
      d.bone = d.ids[0];
      d.mountB = null;
    } else {
      const pslot = par.slots[d.at];
      if (!pslot) throw new Error(`${d.name}: parent "${par.name}" has no slot "${d.at}"`);
      // the joint comes off the PARENT's slot (the part owns that half, and it
      // is modeled whether or not a child ever plugs in) — or off the LINK, for
      // a mounting pad that only grows a joint where one is actually used (the
      // dragon's spare flanks stay bare planks)
      const spec = d.joint ?? pslot.joint;
      if (!spec) throw new Error(`${d.name}: parent slot "${d.at}" offers no joint`);
      const { kind, p: jp = {}, opts = {} } = spec;
      const J = jointSpec(kind);
      const M = J.mounts(jp);
      d.mountB = M.b;

      // seat it in the parent's BONE frame (the parent part is itself bolted
      // into its own joint, so it sits rotated in there)
      const { r: R, t: org } = seatJoint(pslot, M.a, par.seatR, par.seatT);

      // one bone per DOF, chained, each on the joint's axis of motion. A DOF may
      // carry a REST rotation — the fixed bend that seats it (the disc hinge's
      // L, the wrist's crossed second pin); the joint's own seating rotation
      // rides the first bone alongside it.
      d.ids = [];
      let parentBone = par.bone;
      for (let i = 0; i < J.dof.length; i++) {
        const { axis, at, rest } = J.dof[i];
        const off = at(jp);
        const rot = rest ? m3Rot(rest[0], rest[1]) : null;
        const id = i === 0
          ? sk.add(`${d.name}.${axis}`, parentBone, vAdd(org, m3MulV(R, off)), axis,
            rot ? m3Mul(R, rot) : R)
          : sk.add(`${d.name}.${axis}`, parentBone, [...off], axis, rot);
        d.ids.push(id);
        parentBone = id;
      }
      d.bone = parentBone;                                   // the child part rides the last DOF

      // JOINT GEOMETRY — every piece on the bone it rides. bone -1 = the
      // parent's (the female half is rigid with the parent part); pieces on a
      // DOF bone are authored in that bone's frame, so they need no transform.
      const jg = `${d.name}:joint`;
      for (const piece of J.pieces) {
        const onParent = piece.bone < 0;
        const prims = emitTo(onParent ? par.bone : d.ids[piece.bone], jg,
          (add) => piece.build(add, jp, opts));
        if (onParent) seat(prims, R, org);
      }
    }

    // PART BODY — its mount slot bolts onto the joint's mount b (or onto the
    // joint's axis, for a part modeled around the pin it swings on).
    //
    // `flip` bolts the part in the OTHER WAY ROUND: its mount forward reverses,
    // turning the part half a turn about the mount normal — still a rotation, so
    // the no-mirroring rule holds. A symmetric figure needs it on the parts that
    // have a FRONT: its right limbs seat off a reversed pin, so the whole right
    // chain rides a half-turn about the limb axis. A barrel like the shin cannot
    // tell, but the foot's toe and the palm's finger layout would face backwards.
    // Flipping turns their front to the front again — slots and all, so the
    // fingers follow the palm.
    const b = d.mountB;
    const mount = d.flip ? { ...d.slot0, f: vScale(d.slot0.f, -1) } : d.slot0;
    const r = b ? matchRot(b, mount) : I3;
    const bp = b ? (d.slot0.anchor === "axis" ? [0, 0, 0] : b.pos) : null;
    const t = b ? vSub(bp, m3MulV(r, d.slot0.pos)) : vScale(d.slot0.pos, -1);
    d.seatR = r;
    d.seatT = t;
    seat(emitTo(d.bone, `${d.name}:body`,
      (add) => kit.buildPart(d.part, add, d.params ?? null)), r, t);

    // ORPHAN FEMALE HALVES — a slot offering a joint no child took (an empty
    // socket on a spare flank). Real hardware, so it gets modeled: the part
    // carries the half whether or not anything plugs into it.
    for (const [name, s] of Object.entries(d.slots)) {
      if (!s.joint || L.some((c) => c.par === d && c.at === name)) continue;
      const { kind, p: jp = {}, opts = {} } = s.joint;
      const J = jointSpec(kind);
      const { r: R, t: org } = seatJoint(s, J.mounts(jp).a, d.seatR, d.seatT);
      for (const piece of J.pieces) {
        if (piece.bone >= 0) continue;                 // no child, no DOF bones to ride
        seat(emitTo(d.bone, `${d.name}:body`, (add) => piece.build(add, jp, opts)), R, org);
      }
    }
  }

  // the unit meshes the items reference, cached across frames — the renderer
  // draws one instanced call per key
  const meshes = {};

  // --- POSE: the rig's sliders reach the bones through `angles`, one entry per
  // DOF of the link's joint. An axis bone takes [key, sign]; a free bone (a
  // ball) takes three, its euler channels. A rig can always drive `bones`
  // itself instead — that is how the dragon solves its spine off the curve.
  function setPose(pose) {
    for (const d of L) {
      if (!d.angles) continue;
      d.angles.forEach((bind, i) => {
        if (!bind) return;
        const bone = sk.bones[d.ids[i]];
        if (bone.axis === "free") {
          let R = I3;                                  // Rx · Ry · Rz
          bind.forEach((b, k) => {
            if (b?.[0]) R = m3Mul(R, m3Rot(EULER[k], (b[1] ?? 1) * (pose[b[0]] ?? 0)));
          });
          bone.rot = R;
        } else {
          const [key, sign] = bind;
          bone.angle = (sign ?? 1) * (pose[key] ?? 0);
        }
      });
    }
  }

  // --- EMIT: resolve the bones, compose every baked chunk through its bone.
  //
  // `opts.group(id, info)` is the ASSEMBLY HOOK: it displaces any group (a part
  // body, a joint) rigidly, which is all a build animation needs. Return
  // { t?, r?, a? } — an offset, a rotation about the group's own centroid, an
  // alpha — or null to leave it seated. `info` = { id, link, kind, depth, n,
  // centroid }, `n` being the world assembly normal (the direction the group
  // plugs in FROM).
  function emit({ group = null } = {}) {
    const W = sk.resolve();
    const items = [];
    const groups = group ? new Map() : null;

    for (const c of chunks) {
      const w = W[c.bone];
      for (const p of c.prims) {
        const it = {
          key: p.key,
          m: m3Mul(w.r, p.m),
          t: vAdd(m3MulV(w.r, p.t), w.t),
          color: p.color,
          group: c.group,
        };
        items.push(it);
        if (groups) {
          let g = groups.get(c.group);
          if (!g) groups.set(c.group, (g = { items: [], sum: [0, 0, 0] }));
          g.items.push(it);
          g.sum[0] += it.t[0]; g.sum[1] += it.t[1]; g.sum[2] += it.t[2];
        }
      }
    }

    // per-link world data every consumer of the hook wants: how deep the link
    // sits in the chain, and the direction its mount faces in the world
    for (const d of L) {
      const w = W[d.bone];
      d.an = vNorm(vScale(m3MulV(w.r, m3MulV(d.seatR, d.slot0.n)), -1));
    }
    for (const it of items) {
      const d = byName[it.group.slice(0, it.group.indexOf(":"))];
      it.an = d.an;
      it.depth = d.depth;
    }

    if (groups) {
      for (const [id, g] of groups) {
        const [link, kind] = id.split(":");
        const d = byName[link];
        const c = vScale(g.sum, 1 / g.items.length);
        const x = group(id, { id, link, kind, depth: d.depth, n: d.an, centroid: c });
        if (!x) continue;
        for (const it of g.items) {
          if (x.r) {
            const o = vSub(it.t, c);
            it.m = m3Mul(x.r, it.m);
            it.t = vAdd(c, m3MulV(x.r, o));
          }
          if (x.t) it.t = vAdd(it.t, x.t);
          if (x.a !== undefined) it.a = x.a;
        }
      }
    }

    for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
    return { items, meshes };
  }

  return {
    bones: sk.bones,
    skeleton: sk,
    links: L,
    link: (name) => byName[name],
    dof: (name) => byName[name].ids,        // the bone ids of a link's joint, in DOF order
    setPose,
    emit,
  };
}
