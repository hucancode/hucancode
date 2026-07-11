// PART KIT — the registry a rig's part catalog is declared with. A kit is pure
// data: default params, body builders, and a slot table.
//
// A part is a BODY and its SLOTS, and nothing else. It models no joint, has no
// pose and no moving piece: every rotation in the figure happens in a JOINT,
// which the assemble engine instantiates on the slot that offers it. That is
// why a builder takes only (add, params) — there is nothing to pose.
//
//   partModel(name, seed, params)   a standalone { items, meshes } preview
//   buildPart(name, add, params)    raw build for an assembler (a rig)
//   partSlots(name, params)         the part's slots, in part space
//
// Kits are SCOPED: a part name only has to be unique inside its own kit, so the
// atlas has a plain "head" next to the dragon's.
import { bake, meshOf } from "./primitives.js";
import { colorOf } from "./color.js";

// build a model from one builder: instance handles + the unit meshes they
// reference, so the renderer draws one instanced call per key
export function collect(builderFn, seed, params) {
  const items = [];
  const add = (g) => {
    const b = bake(g);
    items.push({ ...b, color: colorOf(b.id, seed) });
  };
  builderFn(add, params);
  const meshes = {};
  for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
  return { items, meshes };
}

// `slots` maps (name, mergedParams) -> { slotName: { pos, n, f, joint?, anchor? } }
export function createKit({ params, builders, slots = () => ({}) }) {
  const names = Object.keys(builders);
  const merge = (name, p) => ({ ...params[name], ...(p || {}) });
  return {
    names,
    params,
    partModel(name, seed = 1, p = null) {
      const key = builders[name] ? name : names[0];
      return collect(builders[key], seed, merge(key, p));
    },
    // parts stay the single source of body geometry: an assembler supplies the
    // add() sink and applies its own placement transform
    buildPart(name, add, p = null) {
      builders[name](add, merge(name, p));
    },
    partSlots(name, p = null) {
      return slots(name, merge(name, p));
    },
  };
}
