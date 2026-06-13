// Standard easings: f: [0,1] -> [0,1], f(0)=0, f(1)=1.
export const EASINGS = {
  linear:        t => t,
  easeInQuad:    t => t * t,
  easeOutQuad:   t => 1 - (1 - t) * (1 - t),
  easeInOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeInCubic:   t => t * t * t,
  easeOutCubic:  t => 1 - Math.pow(1 - t, 3),
  easeInOutCubic:t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInExpo:    t => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo:   t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: t => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
};

export const EASING_NAMES = Object.keys(EASINGS);

export function applyEasing(name, t) {
  const fn = EASINGS[name] || EASINGS.linear;
  return fn(Math.max(0, Math.min(1, t)));
}
