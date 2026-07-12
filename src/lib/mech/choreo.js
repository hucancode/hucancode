// CHOREOGRAPHER — procedural beat generator for a slider-driven rig.
//
// Every `period` seconds it plans a beat. Usually an improvised one, and an
// improvised beat is a STYLE: a short sequence of steps, drawn at random, laid
// end to end across the period. There are four kinds of step —
//   antic  — 1-3 SMALL sliders (leaf-near bones: elbows, wrists, fingers) ramp
//            to new targets. Dead linear, so the extremities read as leading.
//   move   — 1 BIG slider (root-near: waist, shoulder, neck) travels, aimed PAST
//            its target for the bounce to reel back in.
//   bounce — reels that move down onto the target it overshot.
//   rest   — the rig just holds what it is wearing.
// So the styles differ in ATTACK, not in vocabulary: one anticipates twice before
// it swings, one never moves the body at all, and the same knobs time all of them.
//
// Sometimes it plans something rehearsed instead: every slider bounces home to
// the rest pose, or a MONTAGE runs — a setup pose struck with the same bounce,
// then a sequence of keyframes played through. A montage owns the clock for as
// long as it lasts; no beat interrupts it.
//
// The beat mutates the pose object in place, so whatever binds those sliders
// (the mech playground's range inputs) tracks the motion for free. Targets are
// captured from the pose at plan time, so a beat always starts wherever the
// last one — or the user's own dragging — left off.

import { mulberry32 } from "$lib/math/random.js";
import { eases } from "$lib/math/ease.js";
import { lerp } from "$lib/math/scalar.js";

// The beat's shape, all of it adjustable. A period splits into an anticipation
// slice, the main move, and a tail where the rig just holds its new pose; the
// main move spends its own closing `bounceTime` fraction bouncing.
export const CHOREO_TIMING = {
  period: 1.5,        // seconds between beats
  anticRatio: 0.18,   // leading slice of the beat the small sliders ramp across
  restRatio: 0.2,     // trailing slice, everything already settled
  bounceTime: 0.2,    // closing slice of the main move the bounce occupies
  bouncePower: 0.1,  // how far the travel aims past the target, as a fraction
                      // of the distance it covers
  styleBeats: 10,     // beats a style is danced before another is drawn
  switchChance: 0.08, // odds a beat rewires the rig instead of moving it (only
                      // where the caller offers an `onSwitch` — the atlas
                      // mirrored/split toggle; ignored everywhere else)
};
const HOME_CHANCE = 0.05;      // odds a beat is a snap back to the rest pose
const MONTAGE_CHANCE = 0.1;    // odds a beat is a rehearsed montage instead
const SETUP_RATIO = 0.8;       // beats a montage spends striking its setup pose

// The styles, as step lists. The first is the plain one — anticipate, swing,
// bounce onto it, hold — and the rest are what happens when the same steps are
// dealt in another order: two ramps before the swing let the extremities lead
// twice over, an all-antic style never moves the body at all, and back-to-back
// moves keep travelling instead of settling. A style is HELD for `styleBeats`
// beats, so the rig reads as dancing one figure and then changing its mind, rather
// than twitching a new shape every beat.
// A move is always REELED IN by the bounce after it, and a bounce always has a
// move to reel — the two are one gesture dealt as two steps.
const STYLES = [
  ["antic", "move", "bounce", "rest"],
  ["antic", "antic", "move", "bounce"],
  ["antic", "antic", "antic", "rest"],
];
// a style's name IS its steps — the caller pins one by naming it, and shows the
// same string back to whoever is watching
export const CHOREO_STYLES = STYLES.map((s) => s.join("-"));

// an ease like any other, except it leaves [0,1] on the way: constant speed out
// past the target, then outBounce hauls it back to exactly 1
const moveBounce = (time, power) => (t) =>
  t < 1 - time
    ? ((1 + power) * t) / (1 - time)
    : lerp(1 + power, 1, eases.outBounce((t - (1 - time)) / time));

// Aim into the half of the range furthest from where the slider sits, so every
// beat reads as a real move instead of a twitch in place, and draw from the
// 45/90/180 grid inside that half, so the rig strikes machine-square poses.
// Where it sits now is not a candidate — snapping to it would spend the beat
// standing still. A half too narrow to hold any other grid angle falls back to
// a raw draw.
const GRID = 45;
function target(rnd, from, min, max) {
  const mid = (min + max) / 2;
  const [lo, hi] = from < mid ? [mid, max] : [min, mid];
  const grid = [];
  for (let g = Math.ceil(lo / GRID) * GRID; g <= hi; g += GRID) if (g !== from) grid.push(g);
  return grid.length ? grid[(rnd() * grid.length) | 0] : lerp(lo, hi, rnd());
}

// Fisher-Yates prefix: `n` distinct entries out of the pool.
function sample(rnd, pool, n) {
  const a = [...pool];
  for (let i = 0; i < n; i++) {
    const j = i + ((rnd() * (a.length - i)) | 0);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

/**
 * @param sliders  [{ key, min, max, big }] — `big` marks the root-near bones
 * @param home     rest pose the rig occasionally snaps back to
 * @param montages { name: { setup, keys: [{ pose, hold, ease }], loops } } routines
 * @param exclusives [[key, ...]] — groups of channels sharing one joint, of
 *                 which only one may be off its rest pose at a time
 * @param grounded [[[key, ...], ...]] — groups of channel SETS (the atlas's two
 *                 legs), of which at least one set must be sitting at rest at
 *                 every instant, so the figure never leaves the floor
 * @param parked   [key, ...] — channels the beat never picks AND never leaves off
 *                 their rest pose: a beat that finds one adrift walks it home. A
 *                 caller that takes channels out of the rig mid-dance (the atlas
 *                 clamping its mirror on, which grounds both legs) hands them over
 *                 here, and the next beat tidies them away
 * @param onSwitch  optional: called at a beat instead of moving, to rewire the
 *                 rig (the atlas flipping mirrored <-> split). The caller is
 *                 expected to hand the new pose to a FRESH choreographer, since
 *                 the slider set has changed under it — so this one just holds.
 * @param timing   any CHOREO_TIMING key, overriding its default
 */
export function createChoreographer(
  sliders,
  { home = {}, montages = {}, exclusives = [], grounded = [], parked = [],
    onSwitch = null, style: styleName = null, seed = 1, ...timing } = {},
) {
  const { period, anticRatio, restRatio, bounceTime, bouncePower, styleBeats, switchChance } =
    { ...CHOREO_TIMING, ...timing };
  const hit = moveBounce(bounceTime, bouncePower);
  const mainAt = anticRatio * period;
  const mainDur = (1 - restRatio - anticRatio) * period;
  // What each kind of step is WORTH, as a share of a beat — read straight off the
  // timing knobs, so the plain style times exactly as it always did (its four
  // shares sum to the whole period). A style with other steps in it shares the
  // period out in the same proportions, whatever they add up to.
  const STEP_SHARE = {
    antic: anticRatio,
    move: (1 - restRatio - anticRatio) * (1 - bounceTime),
    bounce: (1 - restRatio - anticRatio) * bounceTime,
    rest: restRatio,
  };

  const rnd = mulberry32(seed);
  const small = sliders.filter((s) => !s.big);
  const big = sliders.filter((s) => s.big);
  const routines = Object.values(montages);
  const rest = (key) => home[key] ?? 0;
  // key -> the channels that must sit at rest while it is off its own
  const rivals = {};
  for (const g of exclusives) for (const k of g) rivals[k] = g.filter((x) => x !== k);
  // key -> every channel of the OTHER sets in its grounded group: the ones that
  // have to be resting before this key may be picked at all. Where `rivals` is a
  // rule the beat ENFORCES (park the losers as you move), this one is a rule the
  // beat OBEYS (don't pick a channel that would lift the last standing leg) —
  // parking the other leg over the same window would take both off the floor
  // mid-crossover, which is exactly what must never happen.
  const anchors = {};
  for (const g of grounded)
    for (const set of g)
      for (const k of set) anchors[k] = g.filter((s) => s !== set).flat();
  // A channel may be picked only if the sets anchoring it hold their rest pose at
  // EVERY INSTANT of the beat: sitting at rest where it starts (`was`), and never
  // stirred off it by a step since. Reading where the plan LEAVES them is not
  // enough — a beat that swings leg L out in one step and walks it home in another
  // both starts and ends with L at rest, and would gladly lift leg R alongside that
  // walk home, with both feet off the floor for the length of it. A leg the beat is
  // still bringing down is a leg in the air.
  const allowed = (was, stirred, key) =>
    !anchors[key] || anchors[key].every((k) => was[k] === rest(k) && !stirred.has(k));
  let clock = 0, span = 0;   // time into the current beat, and its length
  let tracks = [];
  let queued = null;         // a montage the caller asked for by hand
  let style = null, styleLeft = 0;   // the style being danced, and the beats it has left
  let pinned = STYLES.find((s) => s.join("-") === styleName) ?? null;   // null = draw at random

  // A montage is a KEYFRAME timeline: the setup pose is struck like any main
  // move, then the keys are played in order. Each key is a partial pose plus the
  // `hold` — in beats — it takes to reach it, so a routine can dwell on one frame
  // and flick through the next; a key names only the channels it moves, and the
  // rest hold whatever the key before left them at. `loops` replays the timeline.
  const montage = (cut, { setup, keys, loops = 1, ease = eases.inOutSine }) => {
    let t = 0;
    for (const [key, to] of Object.entries(setup)) cut(key, to, t, SETUP_RATIO * period, hit);
    t += SETUP_RATIO * period;
    for (let i = 0; i < loops; i++)
      for (const k of keys) {
        const dur = (k.hold ?? 0.35) * period;
        for (const [key, to] of Object.entries(k.pose)) cut(key, to, t, dur, k.ease ?? ease);
        t += dur;
      }
    return t + restRatio * period;
  };

  // every slider drops what it was doing and bounces back to the rest pose
  const snapHome = (cut, cur) => {
    for (const s of sliders) cut(s.key, home[s.key] ?? cur[s.key], mainAt, mainDur, hit);
    return period;
  };

  // AN IMPROVISED BEAT: the current style's steps, laid end to end. A big slider
  // is spent once per beat, so back-to-back moves travel through two joints
  // instead of arguing over one. `cur` is live under the cuts, so a channel the
  // grounded rule blocks is simply skipped — and an antic that lifts a leg blocks
  // the other one for every step that follows in the same beat.
  const improvise = (was, stirred, cur, cut) => {
    // the style is HELD, then swapped for ANOTHER one — redrawing the same style
    // would read as no switch at all. A style pinned by the caller never rotates.
    if (styleLeft <= 0) {
      const pool = STYLES.filter((s) => s !== style);
      style = pinned ?? pool[(rnd() * pool.length) | 0];
      styleLeft = Math.max(1, styleBeats);
    }
    styleLeft--;
    const scale = period / style.reduce((sum, kind) => sum + STEP_SHARE[kind], 0);
    let t = 0;
    let reel = null;   // the move aimed past its target, waiting on the bounce that lands it
    style.forEach((kind) => {
      const dur = STEP_SHARE[kind] * scale;
      if (kind === "antic") {
        const n = 1 + ((rnd() * Math.min(3, small.length)) | 0);
        for (const s of sample(rnd, small, n))
          if (allowed(was, stirred, s.key))
            cut(s.key, target(rnd, cur[s.key], s.min, s.max), t, dur, eases.linear);
      } else if (kind === "move") {
        // draw from the channels still open rather than drawing blind and losing the
        // move when it lands on a leg the figure is standing on
        const open = big.filter((s) => allowed(was, stirred, s.key));
        if (open.length) {
          const s = sample(rnd, open, 1)[0];
          const to = target(rnd, cur[s.key], s.min, s.max);
          // aim PAST it, dead linear, and leave the target for the bounce to land
          cut(s.key, to + bouncePower * (to - cur[s.key]), t, dur, eases.linear);
          reel = { key: s.key, to };
        }
      } else if (kind === "bounce" && reel) {
        cut(reel.key, reel.to, t, dur, eases.outBounce);
        reel = null;
      }
      t += dur;
    });
    return period;
  };

  // A plan is a track list plus the time the whole thing takes: an improvised
  // beat and a home snap each fill one period, a montage runs as long as it
  // needs to. `cur` shadows the pose as the plan is laid out, so a key written
  // twice (a wave passing back through the same joint) starts each leg where
  // the last one left it.
  const plan = (pose) => {
    const was = { ...pose };   // where the beat STARTS, frozen: the grounded rule reads it
    const cur = { ...pose };
    // every channel this beat takes off its rest pose, at any instant of it — a
    // channel walked home later is still stirred, and the grounded rule counts it
    const stirred = new Set();
    tracks = [];
    const push = (key, to, t0, dur, ease) => {
      tracks.push({ key, to, t0, dur, ease, from: cur[key] });
      if (to !== rest(key)) stirred.add(key);
      cur[key] = to;
    };
    // Channels sharing a joint are free to pick their targets independently,
    // and three of them at full swing fold the part through itself. Only one
    // channel of an exclusive group may be activated: taking one off its rest
    // parks its rivals back on theirs, over the same window and ease, so the
    // joint reads as a single clean rotation instead of a tangle.
    const cut = (key, to, t0, dur, ease) => {
      push(key, to, t0, dur, ease);
      if (to === rest(key)) return;
      for (const r of rivals[key] ?? [])
        if (cur[r] !== rest(r)) push(r, rest(r), t0, dur, ease);
    };
    // A parked channel the rig it was handed left adrift — the atlas clamps its
    // mirror on with a leg still in the air, and that leg is now out of the beat
    // with nothing to bring it down. So every beat, whatever else it turns out to
    // be, first walks the parked channels home.
    for (const key of parked)
      if (cur[key] !== rest(key)) cut(key, rest(key), mainAt, mainDur, eases.inOutSine);
    if (queued) {
      const m = queued;
      queued = null;
      return montage(cut, m);
    }
    const roll = rnd();
    // now and then the rig drops everything and snaps home on its own, so the
    // improvised beats don't wander ever further from the rest pose
    if (roll < HOME_CHANCE) return snapHome(cut, cur);
    if (roll < HOME_CHANCE + MONTAGE_CHANCE && routines.length)
      return montage(cut, sample(rnd, routines, 1)[0]);
    // and now and then it rewires itself — the atlas takes its two flanks apart,
    // or puts them back together. The pose carries over, so nothing moves on the
    // beat itself; the next beats are simply planned on the new slider set.
    if (onSwitch && roll < HOME_CHANCE + MONTAGE_CHANCE + switchChance) {
      onSwitch();
      return period;
    }

    return improvise(was, stirred, cur, cut);
  };

  return {
    /** advance the beat and write the rig pose in place */
    step(dt, pose) {
      clock += dt;
      if (clock >= span) { clock -= span; span = plan(pose); }
      for (const t of tracks) {
        const u = (clock - t.t0) / t.dur;
        if (u <= 0) continue;
        // no clamp on the way: the targets are already inside the slider range,
        // and a target sitting ON a range edge (arm fully raised, fist fully
        // closed) would otherwise have its overshoot flattened — the bounce has
        // to swing past every time, not only where there happens to be headroom
        pose[t.key] = u >= 1 ? t.to : lerp(t.from, t.to, t.ease(u));
      }
    },
    /** run a montage by name at the next beat, cutting the current one short */
    play(name) {
      if (!montages[name]) return;
      queued = montages[name];
      clock = span;   // the running beat ends here
    },
    /** cut the running beat short, so the next step plans a fresh one */
    cue() { clock = span; },
    /** the length of the beat now playing, in seconds */
    get span() { return span; },
    /** the style being danced right now, as its step list */
    get style() { return style; },
  };
}
