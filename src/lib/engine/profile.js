let enabled = false;
if (typeof location !== "undefined") {
  enabled = new URLSearchParams(location.search).get("debug") === "true";
}

export const profilingEnabled = () => enabled;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

function done(label, t0) {
  console.log(`[profile] ${label}: ${(now() - t0).toFixed(1)}ms`);
}

export function profile(label, fn) {
  if (!enabled) return fn();
  const t0 = now();
  const r = fn();
  if (r && typeof r.then === "function") {
    return r.finally(() => done(label, t0));
  }
  done(label, t0);
  return r;
}

export function mark(label) {
  if (!enabled) return () => {};
  const t0 = now();
  return () => done(label, t0);
}

export function stamp(label) {
  if (!enabled) return;
  console.log(`[profile] @${now().toFixed(0)}ms ${label}`);
}
