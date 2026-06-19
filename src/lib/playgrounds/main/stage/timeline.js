// Overlapping timeline blocks with a dependency graph — the core of the staging
// framework. A scene is a set of BLOCKS; each owns a slice of scene time
// [start, start + duration], overlaps freely, and is authored independently.
//
// Start resolves one of two ways:
//   { at: <seconds> }                      fixed absolute start
//   { after: { block, branch, offset? } }  startOf(block) + branches[branch] + offset
//
// A BLOCK is a plain descriptor (usually returned by a `create(deps)` factory so
// its dependencies are explicit, never reached out of module scope):
//   name        unique id
//   at|after    start (see above)
//   duration?   omit / Infinity -> PERSISTENT (keeps updating)
//   branches?   { name: localTime }, localTime = number OR () => number. A
//               function branch is resolved when the timeline is built, so a block
//               can hang off a point only known after the scene is assembled
//               WITHOUT the parent being patched after construction.
//   outputs?    [ctx field names this block writes]. createCtx() unions these so
//               the shared ctx is assembled FROM the blocks. defaults(ctx) still
//               sets the resting VALUES.
//   tracks?     { ctxField: (local, ctx) => value }. Declarative property tweens
//               (see stage/track.js). Pure functions of local time -> inherently
//               scrub-safe. Evaluated every frame while active, AFTER defaults()
//               and BEFORE update(), so update() can still override.
//   defaults/setup/seek/update/teardown   lifecycle (below)
//
// Lifecycle per block, driven by the scene clock t (scrubbing both ways is OK):
//   defaults(ctx)       every frame for EVERY block, before any update: restore
//                       the ctx fields this block owns to their resting values.
//   setup(ctx)          once, the frame the block becomes active (incl. seek-in)
//   seek(ctx, local)    when t lands DISCONTINUOUSLY inside an active block
//                       (scrub / reverse); resync derived state here
//   update(ctx, local)  every frame while active; local = t - start in [0, dur]
//   teardown(ctx)       once, the frame the block goes inactive (incl. seek-out)
// ctx is the shared frame-state object every block reads from / writes into.
//
// Blocks are evaluated in array order; author producers before consumers.

export function makeTimeline(blocks) {
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const startCache = new Map();
  const resolving = new Set();

  // localTime of a branch may be a constant or a thunk (resolved here so blocks
  // can hang off runtime-derived points without the parent being patched).
  function branchLocal(parent, branch) {
    const bp = parent.branches && parent.branches[branch];
    return typeof bp === "function" ? bp() : bp;
  }

  function startOf(b) {
    if (startCache.has(b.name)) return startCache.get(b.name);
    if (resolving.has(b.name)) throw new Error(`timeline: cycle through ${b.name}`);
    resolving.add(b.name);
    let s;
    if (b.after) {
      const parent = byName.get(b.after.block);
      if (!parent) throw new Error(`block ${b.name}: unknown parent ${b.after.block}`);
      const bp = branchLocal(parent, b.after.branch);
      if (bp == null) throw new Error(`block ${b.name}: parent ${parent.name} has no branch ${b.after.branch}`);
      s = startOf(parent) + bp + (b.after.offset || 0);
    } else {
      s = b.at || 0;
    }
    resolving.delete(b.name);
    startCache.set(b.name, s);
    return s;
  }
  for (const b of blocks) startOf(b);

  // Assemble the shared ctx FROM the blocks' declared outputs (one hidden class,
  // every key present). Resting VALUES are set by each block's defaults() every
  // frame, so the initial 0 here only fixes the shape.
  function createCtx(extra) {
    const ctx = {};
    for (const b of blocks) for (const k of b.outputs || []) ctx[k] = 0;
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }

  const active = new Set();
  let lastFrameT = null;
  const SEEK_GAP = 0.1; // a t jump larger than this (or any backward step) is a seek

  // Apply a block's declarative tracks: each entry is a pure (local, ctx) -> value
  // written onto ctx. Runs after defaults(), before update().
  function applyTracks(b, ctx, local) {
    if (!b.tracks) return;
    for (const k in b.tracks) ctx[k] = b.tracks[k](local, ctx);
  }

  // Advance every block to scene time t, firing setup/seek/update/teardown.
  function frame(ctx, t) {
    for (const b of blocks) b.defaults && b.defaults(ctx); // restore resting state first
    const seeked = lastFrameT == null || t < lastFrameT || t - lastFrameT > SEEK_GAP;
    for (const b of blocks) {
      const s = startCache.get(b.name);
      const e = b.duration == null ? Infinity : s + b.duration; // omitted -> persists
      const isActive = t >= s && t < e;
      const was = active.has(b.name);
      const local = t - s;
      if (isActive && !was) { b.setup && b.setup(ctx); active.add(b.name); }
      else if (isActive && seeked) b.seek && b.seek(ctx, local); // resync on in-block seek
      if (isActive) {
        applyTracks(b, ctx, local);
        b.update && b.update(ctx, local);
      } else if (was) { b.teardown && b.teardown(ctx); active.delete(b.name); }
    }
    lastFrameT = t;
  }

  return { frame, createCtx };
}
