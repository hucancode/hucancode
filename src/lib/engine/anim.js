// Tween engine, replaces animejs. Animates numeric props on plain objects (+
// arrays) on single shared rAF ticker. Per-property from/to (to may be
// per-target fn), staggered delays, per-property easing, loop/alternate/
// reversed, round, begin/update/complete callbacks.
//
// API mirrors animejs slice scenes use:
//   animate(targets, params)         -> Animation
//   stagger(step)                    -> (el, i) => i * step
//   utils.remove(targetOrArray)      -> cancel tweens on those targets
//   eases.<name> / eases.<name>()    -> easing fn (called or bare)

const OPTION_KEYS = new Set([
  "duration", "delay", "ease", "round", "loop", "alternate", "reversed",
  "iterations", "onBegin", "onUpdate", "onComplete", "autoplay", "alternateLoop",
]);

const hasRAF = typeof requestAnimationFrame !== "undefined";
const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

let animations = [];
let rafId = 0;

function ensureTicker() {
  if (rafId || !hasRAF) return;
  rafId = requestAnimationFrame(tick);
}

function tick() {
  rafId = 0;
  const t = now();
  for (let i = animations.length - 1; i >= 0; i--) {
    const a = animations[i];
    if (a._step(t) || a._dead) animations.splice(i, 1);
  }
  if (animations.length) rafId = requestAnimationFrame(tick);
}

class Animation {
  constructor(targets, params) {
    this.targets = Array.isArray(targets) ? targets.slice() : [targets];
    this.duration = params.duration ?? 1000;
    this.defaultEase = resolveEase(params.ease) || eases.outQuad;
    this.round = params.round ?? 0;
    const inf = params.loop === true || params.iterations === true;
    this.count = inf ? Infinity : typeof params.loop === "number" ? params.loop + 1 : 1;
    this.alternate = !!params.alternate;
    this.reversed = !!params.reversed;
    this.delaySpec = params.delay ?? 0;
    this.onBegin = params.onBegin;
    this.onUpdate = params.onUpdate;
    this.onComplete = params.onComplete;

    this.props = [];
    for (const key in params) {
      if (OPTION_KEYS.has(key)) continue;
      const spec = params[key];
      const obj = spec && typeof spec === "object" && !Array.isArray(spec);
      this.props.push({
        name: key,
        from: obj ? spec.from : undefined,
        to: obj ? spec.to : spec,
        ease: obj ? resolveEase(spec.ease) : null,
      });
    }

    // per-target delay + from/to. captures current value as default from
    this.tracks = this.targets.map((tg, i) => {
      const delay = typeof this.delaySpec === "function"
        ? this.delaySpec(tg, i, this.targets.length)
        : this.delaySpec;
      const ps = this.props.map((p) => {
        let to = typeof p.to === "function" ? p.to(tg, i, this.targets.length) : p.to;
        let from = p.from;
        if (from === undefined) from = tg[p.name] ?? 0;
        else if (typeof from === "function") from = from(tg, i, this.targets.length);
        return { name: p.name, from, to, ease: p.ease };
      });
      return { tg, delay, ps, done: false };
    });

    this._began = false;
    this._dead = false;
    this._start = now();
  }

  _step(t) {
    let allDone = true;
    for (const tr of this.tracks) {
      const e = t - this._start - tr.delay;
      if (e < 0) { allDone = false; continue; }
      if (!this._began) {
        this._began = true;
        this.onBegin && this.onBegin(this);
      }
      const rawIter = e / this.duration;
      const finished = rawIter >= this.count;
      let localT;
      if (finished) {
        // settle on final edge, respect alternate parity
        const lastIter = this.count - 1;
        localT = this.alternate && lastIter % 2 === 1 ? 0 : 1;
        tr.done = true;
      } else {
        const iter = Math.floor(rawIter);
        localT = rawIter - iter;
        if (this.alternate && iter % 2 === 1) localT = 1 - localT;
      }
      if (this.reversed) localT = 1 - localT;
      for (const p of tr.ps) {
        const e2 = (p.ease || this.defaultEase)(localT);
        let v = p.from + (p.to - p.from) * e2;
        if (this.round) v = Math.round(v * this.round) / this.round;
        tr.tg[p.name] = v;
      }
      if (!tr.done) allDone = false;
    }
    this.onUpdate && this.onUpdate(this);
    if (allDone) {
      this._dead = true;
      this.onComplete && this.onComplete(this);
      return true;
    }
    return false;
  }

  cancel() {
    this._dead = true;
  }
}

export function animate(targets, params) {
  const a = new Animation(targets, params);
  animations.push(a);
  ensureTicker();
  return a;
}

export function stagger(step, opts = {}) {
  const start = opts.start ?? 0;
  return (_el, i) => start + i * step;
}

export const utils = {
  remove(target) {
    const list = Array.isArray(target) ? target : [target];
    const set = new Set(list);
    for (let i = animations.length - 1; i >= 0; i--) {
      const a = animations[i];
      a.tracks = a.tracks.filter((tr) => !set.has(tr.tg));
      if (a.tracks.length === 0) {
        a._dead = true;
        animations.splice(i, 1);
      }
    }
  },
};

// each entry callable both ways: `eases.inQuad` used directly as easing fn,
// and `eases.inElastic()` (animejs factory style) returns easing fn
function makeEase(fn) {
  const e = (t) => (t === undefined ? e : fn(t));
  return e;
}
function resolveEase(e) {
  if (!e) return null;
  // factory passed un-called (e.g. eases.outElastic) still works as fn
  return typeof e === "function" ? e : null;
}

const C1 = 1.70158;
const C2 = C1 * 1.525;
const C3 = C1 + 1;
const C4 = (2 * Math.PI) / 3;
const C5 = (2 * Math.PI) / 4.5;
const N1 = 7.5625;
const D1 = 2.75;
function bounceOut(t) {
  if (t < 1 / D1) return N1 * t * t;
  if (t < 2 / D1) return N1 * (t -= 1.5 / D1) * t + 0.75;
  if (t < 2.5 / D1) return N1 * (t -= 2.25 / D1) * t + 0.9375;
  return N1 * (t -= 2.625 / D1) * t + 0.984375;
}

const raw = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t ** 5,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  inOutCirc: (t) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
      : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  inBack: (t) => C3 * t * t * t - C1 * t * t,
  outBack: (t) => 1 + C3 * Math.pow(t - 1, 3) + C1 * Math.pow(t - 1, 2),
  inOutBack: (t) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * ((C2 + 1) * 2 * t - C2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((C2 + 1) * (t * 2 - 2) + C2) + 2) / 2,
  inElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * C4),
  outElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * C4) + 1,
  inOutElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * C5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * C5)) / 2 + 1,
  inBounce: (t) => 1 - bounceOut(1 - t),
  outBounce: bounceOut,
  inOutBounce: (t) =>
    t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2,
};

// outIn* = first half outX, second half inX. mirror of inOut
function outIn(inFn, outFn) {
  return (t) => (t < 0.5 ? outFn(2 * t) / 2 : inFn(2 * t - 1) / 2 + 0.5);
}

export const eases = {};
for (const k in raw) eases[k] = makeEase(raw[k]);
for (const base of ["Quad", "Cubic", "Quart", "Quint", "Sine", "Expo", "Circ", "Back", "Bounce", "Elastic"]) {
  eases["outIn" + base] = makeEase(outIn(raw["in" + base], raw["out" + base]));
}
