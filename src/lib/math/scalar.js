export const TAU = Math.PI * 2;
export const DEG2RAD = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, k) => a + (b - a) * k;

// smoothstep on already-normalised x in [0,1]
export const smooth = (x) => x * x * (3 - 2 * x);

export const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// ramp t across [t0,t1] from a->b, clamped/held outside
export function ramp(t, t0, t1, a, b) {
  if (t <= t0) return a;
  if (t >= t1) return b;
  return a + (b - a) * ((t - t0) / (t1 - t0));
}
