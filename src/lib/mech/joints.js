// JOINT ENGINE — mech joints, out of primitives.js and nothing else: no parts,
// no bones, no rigs. It hands the assemble engine the PIECES a joint is made of
// and a SPEC per kind (its DOFs = the bones a rig spends on it, which piece
// rides which bone, and the two faces the parts bolt onto).
//
// Nomenclature — standard clevis-and-pin hardware:
//   clevis  the forked half: two LUGS (plates with a rounded KNUCKLE bored for
//           the pin) closed by a BASE flange. The gap between them is the JAW.
//   tang    the solid blade filling the jaw, pinned in double shear. A male
//           half is either a nested inner clevis (default) or one tang.
//   pin     one bare shaft through every knuckle bore.
//   female  the half that RECEIVES (outer clevis / socket) — carries the pin,
//           belongs to the PARENT. male = the half that ENTERS, the child's.
//   base    the flange closing a fork / the plate under a socket: the face the
//           owning part bolts to.
//
// TWO CONVENTIONS carry everything downstream:
//   ORIGIN  a joint is authored around its AXIS OF MOTION (pin bore, ball
//           centre, spin axis), so a bone spent on it turns about the origin.
//   MOUNTS  `a` / `b` are the two BOLTING FACES — the outer face of the female
//           base and of the male base. A part puts its slot on its own plain
//           face and never computes how deep the joint reaches.
import {
  box, cylinder, sphere, cutHemisphere, halfCylinderBox,
  rotX, rotY, rotZ, translate,
} from "./primitives.js";

export const HPI = Math.PI / 2;

const JOINT_DEFAULTS = {
  // pinOut = how far the pin pokes past the outer clevis's outboard lug faces;
  // 0 keeps it inside the clevis (clamped to PIN_OUT_MIN, not truly flush)
  hinge: { jaw: 0.24, lugT: 0.12, lugL: 0.45, lugD: 0.55, pinR: 0.14, clr: 0.03, pinOut: 0.05, flangeT: 0.16 },
  pivot: { barrelR: 0.3, barrelLen: 0.8, flangeR: 0.44, neckR: 0.17, neckLen: 0.16, capR: 0.32 },
  ball: { ballR: 0.3, socketT: 0.1, cut: 0.75, studR: 0.11, studLen: 0.3, flangeW: 0.95, flangeT: 0.14 },
  prismatic: { sleeveW: 0.5, sleeveLen: 0.7, sleeveD: 0.5, ramW: 0.3, ramLen: 0.7 },
};

// ---- DIMS ------------------------------------------------------------------
// ONE dims function per joint family, consumed by BOTH the pieces and the mount
// frames, so a mount can never drift from the geometry it seats on.

const PIN_OUT_MIN = 0.005;   // smallest pin overhang past the outboard lug faces

export function hingeDims(p = {}) {
  const q = { ...JOINT_DEFAULTS.hinge, ...p };
  const flangeT = q.flangeT || Math.max(0.12, q.lugT * 1.3);
  const tip = Math.min(0.2, q.lugL * 0.4);        // square lug reach past the pin
  const shank = Math.max(0.05, q.lugL - tip);     // pin -> lug root (where the base seats)
  const jawW = q.jaw + 2 * q.lugT + 2 * q.clr;    // the FEMALE jaw: male half + slack
  return {
    ...q, flangeT, tip, shank, jawW,
    knuckleR: q.lugD / 2,
    reach: shank + flangeT,                       // pin -> base outer face
    // pin half-length: the outboard lug faces plus the pinOut overhang, clamped
    // so the pin's end cap never lands coplanar with a lug face (z-fighting)
    pinHalf: jawW / 2 + q.lugT + Math.max(PIN_OUT_MIN, q.pinOut ?? 0),
  };
}

export function ballDims(p = {}) {
  const q = { ...JOINT_DEFAULTS.ball, ...p };
  return {
    ...q,
    drop: q.ballR * 0.55,                         // socket base plane below the ball centre
    top: q.ballR + q.studLen,                     // ball centre -> stud base underside
  };
}

export function pivotDims(p = {}) {
  const q = { ...JOINT_DEFAULTS.pivot, ...p };
  const flangeT = 0.1, capT = 0.1, half = q.barrelLen / 2;
  return { ...q, flangeT, capT, half, reach: half + flangeT + q.neckLen + capT };
}

export function prismaticDims(p = {}) {
  const q = { ...JOINT_DEFAULTS.prismatic, ...p };
  const halfL = q.sleeveLen / 2;
  const engage = q.sleeveLen * 0.25;   // ram length that must stay engaged in the sleeve
  return { ...q, halfL, engage, travel: Math.max(0, halfL - engage), reach: halfL + q.ramLen };
}

// ---- HINGE PIECES ----------------------------------------------------------
// Pin = X through the origin. The FEMALE opens DOWN (jaw toward -Y, its base
// ABOVE the pin, buried in the parent); the MALE opens UP (base BELOW the pin,
// buried in the child). So a part offers female halves on its far faces and
// brings its own male half at its origin.

// LUG — one fork plate: a D-plate (half-cylinder knuckle + square shank) with
// its knuckle circle (the pin bore) centred on the local origin, plate
// thickness along X. `up` runs the shank +Y (female), else -Y (male).
function lug(d, thickness, xc, up) {
  const g = halfCylinderBox(d.knuckleR, thickness, d.shank, 16);
  rotX(g, -HPI);          // axis -> -Z, knuckle bulge -> +Y, shank -> -Y
  rotY(g, HPI);           // axis (thickness) -> -X
  if (up) rotZ(g, Math.PI);
  return translate(g, xc + (up ? -thickness / 2 : thickness / 2), 0, 0);
}

// the fork: two lugs straddling `jaw`, or one solid tang filling it
function fork(add, d, jaw, up, tang) {
  if (tang) { add(lug(d, jaw + 2 * d.lugT, 0, up)); return; }
  const x = jaw / 2 + d.lugT / 2;
  add(lug(d, d.lugT, -x, up));
  add(lug(d, d.lugT, x, up));
}

// HINGE BASE — the flange closing a fork, one lug shank away from the pin on
// the side opposite the jaw. `disc` swaps the plate for a Y-axis disc
// circumscribing the plate footprint, so the lugs never poke past the rim.
// `w` = the fork's outer width (defaults to the male fork's).
export function hingeBase(add, p, { female = false, disc = false, w } = {}) {
  const d = hingeDims(p);
  const width = w ?? (female ? d.jawW + 2 * d.lugT : d.jaw + 2 * d.lugT);
  const yc = (female ? 1 : -1) * (d.shank + d.flangeT / 2);
  if (disc)                                        // cylinder is base-anchored: shift it
    add(translate(cylinder(Math.hypot(width, d.lugD) / 2, d.flangeT, 24), 0, yc - d.flangeT / 2, 0));
  else
    add(translate(box(width, d.flangeT, d.lugD), 0, yc, 0));
}

// the radius of a female base DISC — what a part blends its body into when it
// wants the joint to grow out of it rather than sit on it (the atlas shoulder)
export const hingeDiscR = (p) => {
  const d = hingeDims(p);
  return Math.hypot(d.jawW + 2 * d.lugT, d.lugD) / 2;
};

// HINGE PIN — one bare shaft (no end caps) through every knuckle bore
export function hingePin(add, p) {
  const d = hingeDims(p);
  add(translate(rotZ(cylinder(d.pinR, 2 * d.pinHalf, 20), -HPI), -d.pinHalf, 0, 0));
}

// HINGE FEMALE — outer fork (wide jaw) + its base + the pin.
// base: false leaves the flange off (the owning part's own body closes the fork).
export function hingeFemale(add, p, { base = true, disc = false, pin = true } = {}) {
  const d = hingeDims(p);
  fork(add, d, d.jawW, true, false);
  if (base) hingeBase(add, p, { female: true, disc });
  if (pin) hingePin(add, p);
}

// HINGE MALE — the nested inner fork, or a solid tang, + its base
export function hingeMale(add, p, { base = true, disc = false, tang = false } = {}) {
  const d = hingeDims(p);
  fork(add, d, d.jaw, false, tang || !!d.tang);
  if (base) hingeBase(add, p, { female: false, disc });
}

// ---- BALL PIECES -----------------------------------------------------------
// Ball centre = the origin. The socket cups the ball from below (its base under
// it, bolting DOWN into the parent), the stud grows up out of the socket mouth
// to its own base (bolting UP into the child).

const ballFlange = (d, w) =>
  d.base === "disc" || d.disc ? cylinder(w / 2, d.flangeT, 24) : box(w, d.flangeT, w);

// BALL BASE — the flange under the socket (female) or on top of the stud (male)
export function ballBase(add, p, { female = false, w } = {}) {
  const d = ballDims(p);
  const width = w ?? (female ? d.flangeW : d.flangeW * 0.75);
  const y = female ? -d.drop - d.flangeT / 2 : d.top + d.flangeT / 2;
  add(translate(ballFlange(d, width), 0, y, 0));
}

// BALL FEMALE — the cut-hemisphere socket cupping the ball, plus its base
export function ballFemale(add, p, { base = true } = {}) {
  const d = ballDims(p);
  const rOut = d.ballR + 0.02 + d.socketT;         // ball + clearance + wall
  if (base) ballBase(add, p, { female: true });
  // cutHemisphere's wall t and cut are FRACTIONS of r
  add(translate(cutHemisphere(rOut, d.socketT / rOut, d.cut, 28, 8), 0, -d.drop, 0));
}

// BALL MALE — the stud: the sphere, the shank out of the socket mouth, its base
export function ballMale(add, p, { base = true } = {}) {
  const d = ballDims(p);
  add(sphere(d.ballR, 20, 14));
  add(cylinder(d.studR, d.top, 18));               // stud shank
  if (base) ballBase(add, p, { female: false });
}

// ---- PIVOT / PRISMATIC PIECES ----------------------------------------------
// PIVOT — a turntable: spin axis = Y through the origin, symmetric barrel with
// a flange ring, neck and end cap on each end. Female = barrel + lower stack.
const pivotStack = (add, d, s) => {
  const at = (g, y) => add(translate(rotX(g, s > 0 ? 0 : Math.PI), 0, s * y, 0));
  at(cylinder(d.flangeR, d.flangeT, 28), d.half);                       // flange disc
  at(cylinder(d.neckR, d.neckLen, 20), d.half + d.flangeT);             // neck
  at(cylinder(d.capR, d.capT, 24), d.half + d.flangeT + d.neckLen);     // end cap
};
export function pivotFemale(add, p) {
  const d = pivotDims(p);
  add(translate(cylinder(d.barrelR, d.barrelLen, 28), 0, -d.half, 0));  // barrel
  pivotStack(add, d, -1);
}
export const pivotMale = (add, p) => pivotStack(add, pivotDims(p), 1);

// PRISMATIC — the one LINEAR joint: a sleeve housing centred on the origin and
// a square RAM running out of each end (slide axis = Y). At slide 0 a ram's
// inner end rests on the sleeve's mid-plane, so the two never collide.
const ram = (add, d, s, slide) => {
  const v = Math.max(0, Math.min(slide || 0, d.travel));
  add(translate(box(d.ramW, d.ramLen, d.ramW), 0, s * (v + d.ramLen / 2), 0));
};
export function prismaticFemale(add, p) {
  const d = prismaticDims(p);
  add(box(d.sleeveW, d.sleeveLen, d.sleeveD));     // sleeve housing
  ram(add, d, -1, 0);                              // the ram that stays with the sleeve
}
export const prismaticMale = (add, p, slide = 0) => ram(add, prismaticDims(p), 1, slide);

// ---- JOINT SPECS -----------------------------------------------------------
// What the assemble engine reads. Per kind:
//
//   dof     the bones the joint costs, parent -> child. ONE bone per rotation
//           axis ("x"/"y"/"z"), or ONE "free" bone taking all axes (a ball), or
//           ONE slide bone ("ty"). `at` = where the bone sits relative to the
//           PREVIOUS one, in joint space; `rest` = a fixed rotation baked on it.
//   pieces  the geometry, tagged with the bone it RIDES and authored in that
//           bone's frame: -1 = the parent's bone (a female half is rigid with
//           the parent part), i = DOF bone i.
//   pose    the channel name of each DOF, in bone order — what a rig's slider
//           binds to. A "free" bone takes THREE (its euler angles).
//   mounts  the two bolting faces { pos, n, f } — `a` is where the PARENT's slot
//           lands (joint space), `b` where the CHILD's does (LAST bone's frame).

const O = [0, 0, 0];
const X = [1, 0, 0], Z = [0, 0, 1];

// Every joint bolts the same way: the two base faces sit `ra` / `rb` out along
// the joint axis, back to back, pointing away from each other. `up` = which way
// the FEMALE base faces (+1 = the clevis family, its base above the pin; -1 =
// the socket family, its base under the ball).
const faces = (ra, rb, f, up = 1) => ({
  a: { pos: [0, up * ra, 0], n: [0, up, 0], f },
  b: { pos: [0, -up * rb, 0], n: [0, -up, 0], f },
});

// the clevis halves as pieces. A kit's opts pick the flange style and whether the
// owning part closes the fork itself; `discM` defaults ON where the male base IS
// the child's turntable (hinge+twist), OFF where it is a plain flange.
const femaleP = {
  bone: -1,
  build: (add, p, o) => hingeFemale(add, p, { base: o.baseF !== false, disc: !!o.discF }),
};
const maleP = (bone, discDflt = false) => ({
  bone,
  build: (add, p, o) => hingeMale(add, p, {
    base: o.baseM !== false,
    disc: discDflt ? o.discM !== false : !!o.discM,
    tang: !!o.tang,
  }),
});
const clevisMounts = (p) => {
  const r = hingeDims(p).reach;
  return faces(r, r, X);
};

// HINGE — plain clevis-and-pin. ONE DOF: the pin swing (X).
const hinge = {
  dof: [{ axis: "x", at: () => O }],
  pose: ["swing"],
  pieces: [femaleP, maleP(0)],
  mounts: clevisMounts,
};

// HINGE + TWIST — a hinge whose male DISC base doubles as a TURNTABLE: the child
// spins on that disc about the tang's axis. TWO bones — swing on the pin (bone 0,
// which the male half rides), then twist about Y (bone 1, bare: only the child
// turns). The elbow of an arm whose forearm can roll.
const hingeTwist = {
  dof: [{ axis: "x", at: () => O }, { axis: "y", at: () => O }],
  pose: ["swing", "twist"],
  pieces: [femaleP, maleP(0, true)],
  mounts: clevisMounts,
};

// PIN — a hinge with no clevis: a BARE knuckle pin the child swings on (the
// atlas finger digits). ONE DOF about X; the pin rides the parent.
const pin = {
  dof: [{ axis: "x", at: () => O }],
  pose: ["swing"],
  pieces: [{ bone: -1, build: (add, p) => hingePin(add, p) }],
  mounts: () => faces(0, 0, X),
};

// DISC HINGE — clevis-and-pin with a DISC on each base. A disc is a body of
// revolution, i.e. a TURNTABLE: bolted face to face it spins. So the block is
// three revolutes in series and costs THREE bones —
//   y  the female disc, spinning in the parent's seat (carries the whole joint)
//   x  the pin swing (the tang, and all that hangs under it)
//   y  the male disc, a turntable for the child (no geometry of its own)
// The pin bone RESTS at 90°, bending the block into the L a limb needs: the
// female disc bolts flat onto a flank and the limb still hangs straight down.
const discHinge = {
  dof: [
    { axis: "y", at: () => O },
    { axis: "x", at: () => O, rest: ["x", HPI] },          // the L: swing the tang down
    { axis: "y", at: () => O },
  ],
  pose: ["spinF", "swing", "spinM"],
  pieces: [
    { bone: 0, build: (add, p) => hingeFemale(add, p, { disc: true }) },
    { bone: 1, build: (add, p) => hingeMale(add, p, { disc: true, tang: true }) },
  ],
  mounts: clevisMounts,
};

// WRIST — TWO hinges in series sharing ONE middle plate (the yoke), plus the male
// disc's turntable: a universal joint with a twist, THREE bones —
//   x  stage-A pin (bend)   x' stage-B pin, rested 90° about Y (tilt)   y  twist
// Stage A's male carries no base: stage B's female base IS the plate both stages
// bolt to. Stage B is the whole hinge turned a quarter turn — which is what
// crosses its pin with stage A's — and that turn lives on the BONE's rest, so the
// tang and the child both ride it.
const wristDrop = (p) => {                                 // stage-B pin, below stage A's
  const d = hingeDims(p);
  return -(2 * d.shank + d.flangeT);
};
const wrist = {
  dof: [
    { axis: "x", at: () => O },
    { axis: "x", at: (p) => [0, wristDrop(p), 0], rest: ["y", -HPI] },
    { axis: "y", at: () => O },
  ],
  pose: ["bend", "tilt", "twist"],
  pieces: [
    femaleP,
    {
      bone: 0,
      build: (add, p, o) => {
        hingeMale(add, p, { base: false, tang: true });                 // yoke top: stage-A male
        // stage-B's female is part of the YOKE, so it rides this bone too, and
        // carries stage B's quarter turn explicitly (bone 1's rest only turns
        // what hangs BELOW the stage-B pin)
        const at = (g) => add(translate(rotY(g, -HPI), 0, wristDrop(p), 0));
        hingeFemale(at, p, { disc: o.discMid !== false });              // its base = THE middle plate
      },
    },
    { bone: 1, build: (add, p, o) => hingeMale(add, p, { disc: o.discM !== false, tang: true }) },
  ],
  mounts: clevisMounts,
};

// BALL — ball-and-socket: ONE bone, all three axes (a "free" bone).
const ball = {
  dof: [{ axis: "free", at: () => O }],
  pose: ["rx", "ry", "rz"],                                  // euler channels of the one bone
  pieces: [
    { bone: -1, build: (add, p, o) => ballFemale(add, p, { base: o.baseF !== false }) },
    { bone: 0, build: (add, p, o) => ballMale(add, p, { base: o.baseM !== false }) },
  ],
  mounts: (p) => {
    const d = ballDims(p);
    return faces(d.drop + d.flangeT, d.top + d.flangeT, Z, -1);
  },
};

// PIVOT — a turntable: ONE bone about the spin axis (Y).
const pivot = {
  dof: [{ axis: "y", at: () => O }],
  pose: ["spin"],
  pieces: [{ bone: -1, build: pivotFemale }, { bone: 0, build: pivotMale }],
  mounts: (p) => faces(pivotDims(p).reach, pivotDims(p).reach, Z, -1),
};

// PRISMATIC — the LINEAR joint: ONE SLIDE bone (travel in model units, not
// radians) along Y.
const prismatic = {
  dof: [{ axis: "ty", at: () => O }],
  pose: ["slide"],
  pieces: [
    { bone: -1, build: prismaticFemale },
    { bone: 0, build: (add, p) => prismaticMale(add, p, 0) },   // the bone does the sliding
  ],
  mounts: (p) => faces(prismaticDims(p).reach, prismaticDims(p).reach, X, -1),
};

export const JOINTS = { hinge, hingeTwist, pin, discHinge, wrist, ball, pivot, prismatic };

export const jointSpec = (kind) => {
  const J = JOINTS[kind];
  if (!J) throw new Error(`unknown joint kind: ${kind}`);
  return J;
};

// STANDALONE JOINT — every piece emitted through `add`, each one carrying the
// DOFs of the bones it rides. This is what the joint catalog previews and what
// any consumer that wants a loose joint (no rig, no bones) calls. `pose` is in
// radians (model units for a slide), keyed by the kind's pose channels.
export function jointModel(kind, add, p = {}, pose = {}, opts = {}) {
  const J = jointSpec(kind);
  const ROT = { x: rotX, y: rotY, z: rotZ };
  // frame of each bone, as a transform applied to geometry authored in it:
  //   parent ∘ T(at) ∘ REST ∘ M(dof)
  const frames = [];
  let ride = (g) => g;
  for (let i = 0; i < J.dof.length; i++) {
    const { axis, at, rest } = J.dof[i];
    const [ox, oy, oz] = at(p);
    const prev = ride;
    const seat = rest ? (g) => prev(translate(ROT[rest[0]](g, rest[1]), ox, oy, oz))
      : (g) => prev(translate(g, ox, oy, oz));
    if (axis === "free") {
      const [rx, ry, rz] = J.pose.map((k) => pose[k] || 0);
      ride = (g) => seat(rotZ(rotY(rotX(g, rx), ry), rz));
    } else if (axis[0] === "t") {                            // slide
      const v = pose[J.pose[i]] || 0, k = "xyz".indexOf(axis[1]);
      const d = [0, 0, 0];
      d[k] = v;
      ride = (g) => seat(translate(g, d[0], d[1], d[2]));
    } else {
      const a = pose[J.pose[i]] || 0, rot = ROT[axis];
      ride = (g) => seat(rot(g, a));
    }
    frames.push(ride);
  }
  for (const piece of J.pieces) {
    const f = piece.bone < 0 ? null : frames[piece.bone];
    piece.build(f ? (g) => add(f(g)) : add, p, opts);
  }
}
