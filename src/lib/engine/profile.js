// Lightweight profiling, gated on `?debug=true`. off by default -> zero cost
// (profile() returns fn() directly). timings print as `[profile] <label>: <ms>`.

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

// time a function. transparent when disabled. sync + async (awaits promise so
// logged time covers full resolution).
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

// manual span: const end = mark("x"); ...; end(); -> noop when disabled
export function mark(label) {
  if (!enabled) return () => {};
  const t0 = now();
  return () => done(label, t0);
}

// absolute timestamp since page navigation start (performance time origin).
// locate WHERE a delay sits on load timeline, not just its duration.
export function stamp(label) {
  if (!enabled) return;
  console.log(`[profile] @${now().toFixed(0)}ms ${label}`);
}
