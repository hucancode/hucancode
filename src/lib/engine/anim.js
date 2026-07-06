import { eases } from "../math/ease.js";
export { eases };

const OPTION_KEYS = new Set(["duration", "delay", "ease", "onComplete"]);

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

const asEase = (e) => (typeof e === "function" ? e : null);

class Animation {
  constructor(targets, params) {
    this.targets = Array.isArray(targets) ? targets.slice() : [targets];
    this.duration = params.duration ?? 1000;
    this.defaultEase = asEase(params.ease) || eases.outQuad;
    this.delaySpec = params.delay ?? 0;
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
        ease: obj ? asEase(spec.ease) : null,
      });
    }

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

    this._dead = false;
    this._start = now();
  }

  _step(t) {
    let allDone = true;
    for (const tr of this.tracks) {
      const e = t - this._start - tr.delay;
      if (e < 0) { allDone = false; continue; }
      const localT = Math.min(e / this.duration, 1);
      tr.done = e >= this.duration;
      for (const p of tr.ps) {
        const e2 = (p.ease || this.defaultEase)(localT);
        tr.tg[p.name] = p.from + (p.to - p.from) * e2;
      }
      if (!tr.done) allDone = false;
    }
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
