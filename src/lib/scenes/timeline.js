// Overlapping timeline blocks with a dependency graph.
//
// A scene is a set of BLOCKS. Each block owns a slice of scene time
// [start, start + duration] and can overlap freely with the others. A block is
// authored independently: it only declares WHEN it starts and exposes named
// BRANCH POINTS (local times) that other blocks can hang off of.
//
// Start of a block is resolved one of two ways:
//   { at: <seconds> }                              fixed absolute start
//   { after: { block, branch, offset? } }          start = startOf(block)
//                                                          + block.branches[branch]
//                                                          + (offset || 0)
// so you can say "begin 0.5s after the glyph block's `end` branch" without
// either block knowing the other's absolute schedule.
//
// `duration` bounds the block; OMIT it (or Infinity) for a PERSISTENT block that
// stays active and keeps updating forever once started (e.g. a dragon that loops
// on indefinitely). Persistent blocks are ignored by endTime().
//
// Lifecycle per block, driven by the scene clock t (scrubbing both ways is OK):
//   setup(ctx)          once, the frame the block becomes active (incl. seek-in)
//   seek(ctx, local)    when t arrives DISCONTINUOUSLY inside an already-active
//                       block (a scrub jump / reverse); resync derived state here
//   update(ctx, local)  every frame while active; local = t - start in [0, dur]
//   teardown(ctx)       once, the frame the block goes inactive (incl. seek-out)
// ctx is the shared frame-state object every block reads from / writes into.
//
// Seeking OUT of a block (a jump to before its start, or past a finite end) fires
// teardown; seeking INTO a block fires setup (if it was inactive) or seek (if it
// was already active), so a block always gets a chance to resync on a scrub.
//
// Blocks are evaluated in array order each frame, so author them in dependency
// order (a producer before its consumers).

export function makeTimeline(blocks) {
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const startCache = new Map();
  const resolving = new Set();

  function startOf(b) {
    if (startCache.has(b.name)) return startCache.get(b.name);
    if (resolving.has(b.name)) throw new Error(`timeline: cycle through ${b.name}`);
    resolving.add(b.name);
    let s;
    if (b.after) {
      const parent = byName.get(b.after.block);
      if (!parent) throw new Error(`block ${b.name}: unknown parent ${b.after.block}`);
      const bp = parent.branches && parent.branches[b.after.branch];
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

  const active = new Set();
  let lastFrameT = null;
  const SEEK_GAP = 0.1; // a t jump larger than this (or any backward step) is a seek

  // Advance every block to scene time t, firing setup/seek/update/teardown.
  function frame(ctx, t) {
    const seeked = lastFrameT == null || t < lastFrameT || t - lastFrameT > SEEK_GAP;
    for (const b of blocks) {
      const s = startCache.get(b.name);
      const e = b.duration == null ? Infinity : s + b.duration; // omitted -> persists
      const isActive = t >= s && t < e;
      const was = active.has(b.name);
      if (isActive && !was) { b.setup && b.setup(ctx); active.add(b.name); }
      else if (isActive && seeked) b.seek && b.seek(ctx, t - s); // resync on in-block seek
      if (isActive) b.update && b.update(ctx, t - s);
      else if (was) { b.teardown && b.teardown(ctx); active.delete(b.name); }
    }
    lastFrameT = t;
  }

  // Reset on (re)load: drop active state + seek history so the next frame
  // re-runs setup for whatever is active at that time.
  function reset() { active.clear(); lastFrameT = null; }

  const startTimeOf = (name) => startCache.get(name);
  const branchAbs = (name, branch) => startCache.get(name) + byName.get(name).branches[branch];
  function endTime() {
    let max = 0;
    for (const b of blocks) {
      if (b.duration == null || !isFinite(b.duration)) continue; // skip persistent
      max = Math.max(max, startCache.get(b.name) + b.duration);
    }
    return max;
  }

  return { frame, reset, startTimeOf, branchAbs, endTime };
}
