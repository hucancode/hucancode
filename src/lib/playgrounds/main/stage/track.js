import { clamp, lerp, smooth } from "$lib/math/scalar.js";

// easing registry: name -> (x in [0,1]) -> eased x in [0,1]
const EASES = {
  linear: (x) => x,
  smooth, // smoothstep, zero slope at both ends
  easeIn: (x) => x * x,
  easeOut: (x) => 1 - (1 - x) * (1 - x),
};
const ease = (name) => (typeof name === "function" ? name : EASES[name] || EASES.linear);

export function hold(v) {
  return () => v;
}

// tween from->to over `dur` sec (block-local), eased. `lead` shifts start
// earlier: value ramps `lead` sec before local 0 -> ink LEADs reveal. dur
// omitted -> hold `to` immediately.
export function tween(from, to, { dur = 0, ease: easing = "linear", lead = 0 } = {}) {
  const ez = ease(easing);
  return (local) => {
    if (dur <= 0) return to;
    const x = clamp((local + lead) / dur, 0, 1);
    return lerp(from, to, ez(x));
  };
}

// piecewise keyframes: [{ at, v, ease? }], `at` block-local seconds. holds v0
// before first key, vN after last; eases each segment with that segment's
// END-keyframe ease (default linear).
export function keyframes(keys) {
  const ks = [...keys].sort((a, b) => a.at - b.at);
  return (local) => {
    if (ks.length === 0) return 0;
    if (local <= ks[0].at) return ks[0].v;
    const last = ks[ks.length - 1];
    if (local >= last.at) return last.v;
    let i = 0;
    while (i < ks.length - 1 && local >= ks[i + 1].at) i++;
    const a = ks[i], b = ks[i + 1];
    const span = b.at - a.at || 1e-6;
    const x = clamp((local - a.at) / span, 0, 1);
    return lerp(a.v, b.v, ease(b.ease)(x));
  };
}

export const track = { hold, tween, keyframes, ease, EASES };
export default track;
