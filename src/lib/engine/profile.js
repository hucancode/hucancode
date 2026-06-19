// Lightweight profiling, gated on `?debug=true`. Off by default -> zero cost
// (profile() returns fn() directly). Enable by loading any page with
// `?debug=true`; timings print to the console as `[profile] <label>: <ms>`.

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

// Time a function. Transparent when disabled. Handles sync + async (awaits the
// promise so the logged time covers the full resolution).
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

// Manual span: const end = mark("x"); ...; end(); -> noop when disabled.
export function mark(label) {
  if (!enabled) return () => {};
  const t0 = now();
  return () => done(label, t0);
}

// Absolute timestamp since page navigation start (performance time origin).
// Use to locate WHERE a delay sits on the load timeline, not just its duration.
export function stamp(label) {
  if (!enabled) return;
  console.log(`[profile] @${now().toFixed(0)}ms ${label}`);
}
