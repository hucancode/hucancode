export function makeTimeline(blocks) {
  // every block declares an absolute start time
  const startCache = new Map(blocks.map((b) => [b.name, b.at || 0]));

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
