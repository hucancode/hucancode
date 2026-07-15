// Editor domain logic: assembly-tree CRUD, part-ops editing, attachment semantics.
// Pure functions over plain model objects — a Svelte $state proxy passes through
// unchanged, so mutations made here stay reactive for the caller.
//
// model = { parts:{id:spec}, baseY, root:<node> }. A node = a clone of a brick:
// { part, children?:[...node], + how it attaches to its parent (on/off/rot/…) }.
import { connMode } from "./assembly.js";
import { STICK_ENDS, STICK_LEN, stickSize } from "./solid.js";
import { PALETTE, TEMPLATES, MODEL } from "./templates.js";

export { connMode };

export const range = (n) => Array.from({ length: n }, (_, i) => i);
export const endCount = (spec) => (spec.stick ? STICK_ENDS : 0);

export const COLORS = Object.keys(PALETTE);
// colors are stored as real hex; PALETTE keys are presets resolved to hex.
export const hexOf = (c) => (PALETTE[c] ?? c ?? "#888888").toLowerCase();

export const FACES = ["y+", "y-", "x+", "x-", "z+", "z-"];
export const MOUNTS = ["top", "bottom", "front", "back", "left", "right"];
// where the node attaches drives the rotation logic: "face" = rigid stud clutch
// (90deg rot + parity snap); "hinge" = articulated pivot (continuous joint).
export const ATTACH = ["face", "hinge"];
export const FREE_JOINTS = ["hinge", "ball"];

export const defaultModel = () => structuredClone(MODEL);
export const templateOf = (id) => TEMPLATES.find((t) => t.id === id);
export const firstPartId = (m) => Object.keys(m?.parts ?? {})[0] ?? "";
// editing usually starts on the first child; a bare root has nothing else
export const defaultNode = (m) => m?.root?.children?.[0] ?? m?.root ?? null;

// ---- assembly tree walk + node ops ----------------------------------------
export function* walkNodes(node, depth = 0, parent = null) {
  if (!node) return;
  yield { node, depth, parent };
  for (const ch of node.children ?? []) yield* walkNodes(ch, depth + 1, node);
}
export const nodeIndex = (list, n) => list.findIndex((x) => x.node === n);

export function findParent(root, target) {
  for (const ch of root?.children ?? []) {
    if (ch === target) return root;
    const r = findParent(ch, target);
    if (r) return r;
  }
  return null;
}
export const isDescendant = (node, maybe) => {
  if (maybe === node) return true;
  for (const ch of node.children ?? []) if (isDescendant(ch, maybe)) return true;
  return false;
};
export function addChild(parent, part) {
  if (!parent) return null;
  const n = { part, on: "top", off: [0, 0], rot: [0, 0, 0] };
  parent.children = [...(parent.children ?? []), n];
  return n;
}
export function removeNode(root, node) {
  const p = findParent(root, node);
  if (!p) return false; // root: not removable
  p.children = p.children.filter((c) => c !== node);
  return true;
}
export function reparent(root, node, newParent) {
  if (!newParent || node === root || isDescendant(node, newParent)) return;
  const p = findParent(root, node);
  if (!p) return;
  p.children = p.children.filter((c) => c !== node);
  newParent.children = [...(newParent.children ?? []), node];
}
// legal new-parents for a node: any node not inside its own subtree
export const parentOptions = (list, node) =>
  list
    .filter((x) => !isDescendant(node, x.node))
    .map((x) => ({
      i: nodeIndex(list, x.node),
      label: `${nodeIndex(list, x.node)} ${x.node.part}`,
    }));

// ---- part ops editing ------------------------------------------------------
export const OP_DEFAULTS = {
  slope: () => ({
    op: "slope",
    face: "y+",
    dir: 1,
    length: 2,
    depth: 2,
    round: false,
  }),
  push: () => ({
    op: "push",
    face: "z+",
    depth: 1,
    width: 1,
    height: 1,
    at: [0, 0],
  }),
  studs: () => ({ op: "studs", face: "y+", kind: "male" }),
  ball: () => ({ op: "ball", face: "y+", kind: "male", at: { cell: [0, 0] } }),
  hinge: () => ({
    op: "hinge",
    face: "y+",
    pin: "x",
    kind: "male",
    shape: "O",
    at: { cell: [0, 0] },
  }),
};
export const opAdd = (spec, t) => {
  // on a stick, connectors target an `end` index instead of a box face
  const op = spec.stick
    ? { op: t, end: 0, kind: "male", ...(t === "hinge" ? { shape: "O" } : {}) }
    : OP_DEFAULTS[t]();
  spec.ops = [...spec.ops, op];
};
export const opRemove = (spec, i) => {
  spec.ops = spec.ops.filter((_, j) => j !== i);
};
export const opMove = (spec, i, d) => {
  const j = i + d;
  if (j < 0 || j >= spec.ops.length) return;
  const next = spec.ops.slice();
  [next[i], next[j]] = [next[j], next[i]];
  spec.ops = next;
};
// hinge: pin axis must lie in the mount face (≠ face axis); position is a cell
export const pinAxes = (face) =>
  ["x", "y", "z"].filter((a) => a !== (face ?? "y+")[0]);
export function setHingeFace(o, f) {
  o.face = f;
  if (!pinAxes(f).includes(o.pin)) o.pin = pinAxes(f)[0]; // keep pin valid
}
export const hingeCell = (o) => o.at?.cell ?? [0, 0];
export function setHingeCell(o, i, v) {
  const cell = hingeCell(o).slice();
  cell[i] = +v;
  o.at = { cell };
}
export function studRegion(o) {
  if (!o.at) return "all";
  if ("row" in o.at) return "row";
  if ("col" in o.at) return "col";
  if ("cell" in o.at) return "cell";
  return "all";
}
export function setStudRegion(o, r) {
  if (r === "all") o.at = undefined;
  else if (r === "row") o.at = { row: 0 };
  else if (r === "col") o.at = { col: 0 };
  else o.at = { cell: [0, 0] };
}

// ---- parts CRUD ------------------------------------------------------------
export function addPart(model) {
  let n = 1,
    id = "part1";
  while (model.parts[id]) id = `part${++n}`;
  model.parts[id] = {
    size: [2, 3, 3],
    ops: [
      { op: "studs", face: "y+" },
      { op: "studs", face: "y-", kind: "female" },
    ],
    color: COLORS[0],
  };
  return id;
}
// I/Y/T connector stick: a part with branching rods; one male stud per end.
export function addStick(model) {
  let n = 1,
    id = "stick1";
  while (model.parts[id]) id = `stick${++n}`;
  const len = STICK_LEN;
  model.parts[id] = {
    stick: "I",
    len,
    size: stickSize(len),
    ops: range(STICK_ENDS).map((i) => ({ op: "studs", end: i, kind: "male" })),
    color: COLORS[0],
  };
  return id;
}
// stick length: half-length in studs; keep the bounding-box size in sync
export function setStickLen(spec, v) {
  spec.len = +v;
  spec.size = stickSize(+v);
}
// pointy stick ends: spec.tips = list of end indices tapered to a point
export const tipSel = (s) => {
  const t = s.tips ?? [];
  if (t.length >= 2) return "both";
  if (t.includes(1)) return "1";
  if (t.includes(0)) return "0";
  return "none";
};
export function setTips(s, v) {
  s.tips = v === "both" ? [0, 1] : v === "none" ? undefined : [Number(v)];
}
// remove a brick from the library AND prune every tree node that clones it
function pruneNodes(node, id) {
  if (!node?.children) return;
  node.children = node.children.filter((c) => c.part !== id);
  node.children.forEach((c) => pruneNodes(c, id));
}
export function removePart(model, id) {
  const { [id]: _, ...rest } = model.parts;
  model.parts = rest;
  if (model.root?.part === id) {
    const nid = firstPartId(model);
    model.root = nid ? { part: nid } : null;
  } else {
    pruneNodes(model.root, id);
  }
}
function renameNodes(node, oldId, newId) {
  if (!node) return;
  if (node.part === oldId) node.part = newId;
  node.children?.forEach((c) => renameNodes(c, oldId, newId));
}
export function renamePart(model, oldId, newId) {
  newId = newId.trim();
  if (!newId || newId === oldId || model.parts[newId]) return null;
  model.parts = Object.fromEntries(
    Object.entries(model.parts).map(([k, v]) => [k === oldId ? newId : k, v]),
  );
  renameNodes(model.root, oldId, newId);
  return newId;
}

// ---- node attachment editing ------------------------------------------------
// node rotation: [x,y,z] degrees, each a multiple of 90. legacy `angle` = Y.
export const connRot = (c) => c.rot ?? [0, c.angle ?? 0, 0];
export function setConnRot(c, i, v) {
  const r = connRot(c).slice();
  r[i] = +v;
  c.rot = r;
  delete c.angle; // drop legacy field once edited
}
export const setOff = (c, i, v) => {
  const o = [c.off?.[0] ?? 0, c.off?.[1] ?? 0];
  o[i] = Math.round(+v);
  c.off = o;
};
export const hingesOf = (model, id) =>
  (model.parts[id]?.ops ?? [])
    .map((o, i) => ({ i, o }))
    .filter((x) => x.o.op === "hinge");
export const hasHinge = (model, id) => hingesOf(model, id).length > 0;
export const canHinge = (model, node, parent) =>
  hasHinge(model, parent?.part) && hasHinge(model, node.part);
export const hingeLabel = (o) =>
  o.end != null
    ? `end${o.end} ${o.kind ?? "male"} ${o.shape ?? "O"}`
    : `${o.face ?? "y+"} ${o.kind ?? "male"} ${o.shape ?? "O"}`;
export const attachOf = (c) =>
  c.attach ?? (connMode(c) === "free" ? "hinge" : "face");
export function setAttach(model, c, a, node, parent) {
  if (a === "hinge" && !canHinge(model, node, parent)) return; // both parts need a hinge op
  c.attach = a;
  if (a === "hinge") {
    if (c.joint !== "ball" && c.joint !== "hinge") setJoint(c, "hinge");
  } else setJoint(c, "none");
}
// joint articulation: ball = free jrot[u,v,n]deg, hinge = pitch (pin/X) + yaw (N/Y)
export function setJoint(c, kind) {
  if (kind === "ball") {
    c.joint = "ball";
    c.jrot = c.jrot ?? [0, 0, 0];
    delete c.jangle;
    delete c.axis;
  } else if (kind === "hinge") {
    c.joint = "hinge";
    c.jpitch = c.jpitch ?? c.jangle ?? 0;
    c.jyaw = c.jyaw ?? 0;
    delete c.jrot;
    delete c.jangle;
    delete c.axis;
  } else {
    delete c.joint;
    delete c.jrot;
    delete c.jangle;
    delete c.axis;
    delete c.jpitch;
    delete c.jyaw;
  }
}
export const jrotOf = (c) => c.jrot ?? [0, 0, 0];
export function setJrot(c, i, v) {
  const r = jrotOf(c).slice();
  r[i] = +v;
  c.jrot = r;
}
export const setLocal = (c, on) => {
  if (on) c.local = true;
  else delete c.local;
};

// sub-assembly rooted at `node` (its own attachment to its parent dropped)
export function isoModel(parts, node) {
  if (!node) return null;
  return {
    parts,
    baseY: 0,
    root: { part: node.part, children: node.children ?? [] },
  };
}
