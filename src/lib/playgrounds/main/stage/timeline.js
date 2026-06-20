// Overlapping timeline blocks with dependency graph. scene = set of BLOCKS, each
// owns scene-time slice [start, start+duration], overlaps freely.
//
// Start resolves two ways:
//   { at: <seconds> }                      fixed absolute start
//   { after: { block, branch, offset? } }  startOf(block) + branches[branch] + offset
//
// BLOCK fields:
//   name        unique id
//   at|after    start (see above)
//   duration?   omit / Infinity -> PERSISTENT (keeps updating)
//   branches?   { name: localTime }, localTime = number OR () => number. fn branch
//               resolved at timeline build, so block can hang off point known only
//               after scene assembled, WITHOUT patching parent post-construction.
//   outputs?    [ctx field names this block writes]. createCtx() unions these ->
//               shared ctx assembled FROM blocks. defaults(ctx) sets resting VALUES.
//   tracks?     { ctxField: (local, ctx) => value }. pure fns of local -> scrub-
//               safe. evaluated every active frame, AFTER defaults() BEFORE
//               update(), so update() can override.
//   defaults/setup/seek/update/teardown   lifecycle (below)
//
// Lifecycle per block, driven by scene clock t (scrub both ways OK):
//   defaults(ctx)       every frame EVERY block, before any update: restore owned
//                       ctx fields to resting values.
//   setup(ctx)          once, frame block becomes active (incl. seek-in)
//   seek(ctx, local)    t lands DISCONTINUOUSLY inside active block (scrub/reverse);
//                       resync derived state here
//   update(ctx, local)  every active frame; local = t - start in [0, dur]
//   teardown(ctx)       once, frame block goes inactive (incl. seek-out)
//
// Blocks evaluated in array order; author producers before consumers.

export function makeTimeline(blocks) {
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const startCache = new Map();
  const resolving = new Set();

  // branch localTime constant or thunk. resolved here so blocks hang off
  // runtime-derived points without patching parent.
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

  // assemble shared ctx FROM blocks' declared outputs (one hidden class, every
  // key present). defaults() sets resting VALUES each frame, so initial 0 here
  // only fixes shape.
  function createCtx(extra) {
    const ctx = {};
    for (const b of blocks) for (const k of b.outputs || []) ctx[k] = 0;
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }

  const active = new Set();
  let lastFrameT = null;
  const SEEK_GAP = 0.1; // t jump > this (or any backward step) is a seek

  function applyTracks(b, ctx, local) {
    if (!b.tracks) return;
    for (const k in b.tracks) ctx[k] = b.tracks[k](local, ctx);
  }

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
