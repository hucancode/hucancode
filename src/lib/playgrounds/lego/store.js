// Persistence for the lego editor: schema check, legacy migration, save slots.
import { makeSlots, slotLabel } from "$lib/save-slots.js";
import { defaultModel } from "./model-ops.js";

export { slotLabel };

export const SLOT_COUNT = 5;
const LEGACY_KEY = "lego-eagle-model"; // old single-slot store

// op-model = every part has size[] + ops[]; reject stale/legacy stores
export function isOpModel(m) {
  return (
    m &&
    m.parts &&
    Object.values(m.parts).every(
      (p) => Array.isArray(p.size) && Array.isArray(p.ops),
    )
  );
}

// accept tree models as-is; migrate old flat {root, connections} stores to a tree.
export function asTree(m) {
  if (!m) return m;
  if (m.root && typeof m.root === "object") return m; // already a tree
  if (Array.isArray(m.connections)) return flatToTree(m);
  return m;
}

// flat {root:id, connections:[{a,b,...}]} -> tree. First connection naming a part
// as `b` becomes its canonical node (gets its children); repeats become clones.
function flatToTree(m) {
  const conns = m.connections ?? [];
  const children = new Set(conns.map((c) => c.b));
  const rootId =
    Object.keys(m.parts).find((id) => !children.has(id)) ??
    m.root ??
    Object.keys(m.parts)[0];
  const rootNode = { part: rootId, children: [] };
  const canon = new Map([[rootId, rootNode]]);
  for (const c of conns) {
    const { a, b, ...attach } = c;
    const node = { part: b, ...attach, children: [] };
    (canon.get(a) ?? rootNode).children.push(node);
    if (!canon.has(b)) canon.set(b, node);
  }
  const clean = (n) => {
    if (!n.children?.length) delete n.children;
    else n.children.forEach(clean);
    return n;
  };
  return { parts: m.parts, baseY: m.baseY ?? 0, root: clean(rootNode) };
}

// shared slot store; revive rejects stale/legacy payloads, migrates to tree
export const slots = makeSlots({
  prefix: "lego-eagle-slot-",
  count: SLOT_COUNT,
  field: "model",
  revive: (m) => (isOpModel(m) ? asTree(m) : null),
});

// initial: slot 0, else migrate the legacy single store, else the default template
export function loadModel() {
  const e = slots.read(0);
  if (e) return e.payload;
  if (typeof localStorage !== "undefined") {
    try {
      const m = JSON.parse(localStorage.getItem(LEGACY_KEY));
      if (isOpModel(m)) return asTree(m);
    } catch {
      /* corrupt store -> default */
    }
  }
  return defaultModel();
}
