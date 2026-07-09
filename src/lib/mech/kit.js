// PART KIT — the shared registry every rig's part catalog is declared with.
// A kit is pure data: default params, builder functions, and a slot lookup.
// The engine below turns that into the three calls the pages and rigs need:
//
//   partModel(name, seed, params, pose)  a standalone { items, meshes } preview
//   buildPart(name, add, params, pose)   raw build for an assembler (a rig)
//   partSlots(name, params)              the part's mount slots, in part space
//
// Kits are SCOPED: a part name only has to be unique inside its own kit, so
// the atlas has a plain "head" next to the dragon's.
import { bake, meshOf } from "./primitives.js";
import { colorOf } from "./color.js";

// build a model from one builder: instance handles + the unit meshes they
// reference, so the renderer draws one instanced call per key
export function collect(builderFn, seed, params, pose) {
  const items = [];
  const add = (g) => {
    const b = bake(g);
    items.push({ ...b, color: colorOf(b.id, seed) });
  };
  builderFn(add, params, pose);
  const meshes = {};
  for (const it of items) if (!meshes[it.key]) meshes[it.key] = meshOf(it.key);
  return { items, meshes };
}

// `slots` maps (name, mergedParams) -> { slotName: { pos, n, f } }; a kit with
// no slots (the joint catalog) may leave it out.
export function createKit({ params, builders, slots = () => ({}) }) {
  const names = Object.keys(builders);
  const merge = (name, p) => ({ ...params[name], ...(p || {}) });
  return {
    names,
    params,
    partModel(name, seed = 1, p = null, pose = null) {
      const key = builders[name] ? name : names[0];
      return collect(builders[key], seed, merge(key, p), pose || {});
    },
    // parts stay the single source of geometry: a rig supplies the add() sink
    // and applies its own placement transform, it never re-models anything
    buildPart(name, add, p = null, pose = null) {
      builders[name](add, merge(name, p), pose || {});
    },
    partSlots(name, p = null) {
      return slots(name, merge(name, p));
    },
  };
}
