export function makeTimeline(blocks) {
  const byName = new Map(blocks.map((b) => [b.name, b]));
  const startCache = new Map();
  const resolving = new Set();

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

  function createCtx(extra) {
    const ctx = {};
    for (const b of blocks) for (const k of b.outputs || []) ctx[k] = 0;
    if (extra) Object.assign(ctx, extra);
    return ctx;
  }

  const active = new Set();
  let lastFrameT = null;
  const SEEK_GAP = 0.1;

  function applyTracks(b, ctx, local) {
    if (!b.tracks) return;
    for (const k in b.tracks) ctx[k] = b.tracks[k](local, ctx);
  }

  function frame(ctx, t) {
    for (const b of blocks) b.defaults && b.defaults(ctx);
    const seeked = lastFrameT == null || t < lastFrameT || t - lastFrameT > SEEK_GAP;
    for (const b of blocks) {
      const s = startCache.get(b.name);
      const e = b.duration == null ? Infinity : s + b.duration;
      const isActive = t >= s && t < e;
      const was = active.has(b.name);
      const local = t - s;
      if (isActive && !was) { b.setup && b.setup(ctx); active.add(b.name); }
      else if (isActive && seeked) b.seek && b.seek(ctx, local);
      if (isActive) {
        applyTracks(b, ctx, local);
        b.update && b.update(ctx, local);
      } else if (was) { b.teardown && b.teardown(ctx); active.delete(b.name); }
    }
    lastFrameT = t;
  }

  return { frame, createCtx };
}
