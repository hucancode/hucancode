// RIG — the shared shell every articulated figure builds on. A rig declares
// LINKS (parts bolted through parent slots) and a pose SOLVE (how pose channels
// become bone writes); createRig wraps createAssembly, runs a one-time `setup`
// to measure the built skeleton, and returns a `model(pose, opts, env)` that
// merges the rest pose, runs the solve, poses the bones and emits the meshes.
//
// Pose channels are RADIANS end to end here (and in choreo.js): the UI pages
// hold degrees and convert at the boundary via math/scalar.js `rad`/`deg`.
import { createAssembly } from "./assemble.js";

export function createRig({ kit, links, rest = {}, seed = 1, setup = null, solve = null }) {
  const rig = createAssembly({ kit, links, seed });
  const ctx = setup ? setup(rig) : {};

  function model(pose = {}, opts = {}, env = undefined) {
    const o = { ...rest, ...pose };
    if (solve) solve(o, rig, ctx, env);
    rig.setPose(o);
    return rig.emit(opts);
  }

  return { model, rig, ctx };
}

// a rig is baked geometry: rebuild only when its seed changes
export function rigCache(create) {
  let cached = null, cachedSeed = null;
  return (seed = 1) => {
    if (!cached || cachedSeed !== seed) { cached = create(seed); cachedSeed = seed; }
    return cached;
  };
}

// world-space Y bounds of an emitted model's mesh vertices (y-up rig space).
// An atlas-style figure plants its root on the grid from these.
export function boundsY(items, meshes) {
  let minY = Infinity, maxY = -Infinity;
  for (const it of items) {
    const mesh = meshes?.[it.key];
    if (!mesh?.positions) continue;
    const p = mesh.positions;
    for (let i = 0; i < p.length; i += 3) {
      const y = it.m[3] * p[i] + it.m[4] * p[i + 1] + it.m[5] * p[i + 2] + it.t[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minY, maxY, height: maxY - minY };
}
