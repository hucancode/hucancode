// CHOREOGRAPHER — procedural beat generator for a slider-driven rig.
//
// Every `period` seconds it plans a beat. Usually an improvised one, out of two
// groups:
//   anticipation — 1-3 SMALL sliders (leaf-near bones: elbows, wrists,
//                  fingers). Plain linear ramps, fired first so the
//                  extremities lead the body.
//   main         — 1 BIG slider (root-near bone: waist, shoulder, neck) played
//                  move-hit: a dead-linear travel aimed PAST the target, then
//                  a bounce that reels it back down onto it.
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
};
const HOME_CHANCE = 0.05;      // odds a beat is a snap back to the rest pose
const MONTAGE_CHANCE = 0.1;    // odds a beat is a rehearsed montage instead
const SETUP_RATIO = 0.8;       // beats a montage spends striking its setup pose

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
 * @param timing   any CHOREO_TIMING key, overriding its default
 */
export function createChoreographer(
  sliders, { home = {}, montages = {}, exclusives = [], seed = 1, ...timing } = {},
) {
  const { period, anticRatio, restRatio, bounceTime, bouncePower } =
    { ...CHOREO_TIMING, ...timing };
  const hit = moveBounce(bounceTime, bouncePower);
  const mainAt = anticRatio * period;
  const mainDur = (1 - restRatio - anticRatio) * period;

  const rnd = mulberry32(seed);
  const small = sliders.filter((s) => !s.big);
  const big = sliders.filter((s) => s.big);
  const routines = Object.values(montages);
  const rest = (key) => home[key] ?? 0;
  // key -> the channels that must sit at rest while it is off its own
  const rivals = {};
  for (const g of exclusives) for (const k of g) rivals[k] = g.filter((x) => x !== k);
  let clock = 0, span = 0;   // time into the current beat, and its length
  let tracks = [];
  let queued = null;         // a montage the caller asked for by hand

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

  // A plan is a track list plus the time the whole thing takes: an improvised
  // beat and a home snap each fill one period, a montage runs as long as it
  // needs to. `cur` shadows the pose as the plan is laid out, so a key written
  // twice (a wave passing back through the same joint) starts each leg where
  // the last one left it.
  const plan = (pose) => {
    const cur = { ...pose };
    tracks = [];
    const push = (key, to, t0, dur, ease) => {
      tracks.push({ key, to, t0, dur, ease, from: cur[key] });
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

    const n = 1 + ((rnd() * Math.min(3, small.length)) | 0);
    for (const s of sample(rnd, small, n))
      cut(s.key, target(rnd, cur[s.key], s.min, s.max), 0, anticRatio * period, eases.linear);
    if (big.length) {
      const s = sample(rnd, big, 1)[0];
      cut(s.key, target(rnd, cur[s.key], s.min, s.max), mainAt, mainDur, hit);
    }
    return period;
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
  };
}
