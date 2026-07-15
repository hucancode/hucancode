// CHOREOGRAPHER — procedural beat generator for a slider-driven rig. Every `period` it
// plans a beat and mutates the pose in place; targets are captured at plan time, so a
// beat starts wherever the last one, or the user's dragging, left off.
//
// An improvised beat is a STYLE: steps laid end to end across the period.
//   antic  1-3 SMALL sliders (elbows, wrists) ramp linearly — the extremities lead
//   move   1 BIG slider (waist, shoulder, neck) travels, aimed PAST its target
//   bounce reels that move down onto the target it overshot
//   rest   a hold, emitting no cuts at all
//
// A beat may instead be rehearsed: a snap home, or a MONTAGE (setup + keyframes). Every
// plan is beat-length or a WHOLE multiple of it, so an outside clock (the music) can rely
// on the beat and never has to ask what the rig is in the middle of.
import { mulberry32 } from "$lib/math/random.js";
import { eases } from "$lib/math/ease.js";
import { lerp } from "$lib/math/scalar.js";

export const CHOREO_TIMING = {
  period: 1.5,        // seconds between beats
  anticRatio: 0.18,   // leading slice the small sliders ramp across
  restRatio: 0.1,     // trailing slice, everything already settled
  bounceTime: 0.2,    // closing slice of the main move the bounce occupies
  bouncePower: 0.1,   // how far the travel aims past its target, as a fraction of
                      // the distance it covers
  styleBeats: 10,     // beats a style is danced before another is drawn
  pulseChance: 0.25,  // odds a beat travels a PULSE channel
  splitChance: 0.1,   // mirrored -> split
  mergeChance: 0.3,   // split -> mirrored
};
const NEAR_END = 0.05;         // a cue this close to the beat's end is that beat ENDING
const HOME_CHANCE = 0.05;      // odds a beat is a snap back to the rest pose
const MONTAGE_CHANCE = 0.1;    // odds a beat is a rehearsed montage instead
const SETUP_RATIO = 0.8;       // beats a montage spends striking its setup pose

// The styles, as step lists: the same steps in different orders. A move is always REELED
// IN by the bounce after it — the two are one gesture in two steps.
const STYLES = [
  ["antic", "move", "bounce", "rest"],
  ["antic", "antic", "move", "bounce"],
  ["antic", "antic", "antic", "rest"],
];
export const CHOREO_STYLES = STYLES.map((s) => s.join("-"));

// THE BEAT CLOCK, off the music's tempo: `beats` quarter notes to a beat. Its grid is a
// 16th, halved until the longest style's every step can hold two ticks — snap() needs
// that room, or a style finer than the grid is left where it fell.
const MAX_STEPS = Math.max(...STYLES.map((s) => s.length));
export function beatClock(bpm, beats) {
  const period = (beats * 60) / bpm;
  let grid = period / (beats * 4);
  while (period / grid < 2 * MAX_STEPS) grid /= 2;
  return { period, grid };
}

// an ease that LEAVES [0,1] on the way: constant speed out past the target, then
// outBounce hauls it back to exactly 1
const moveBounce = (time, power) => (t) =>
  t < 1 - time
    ? ((1 + power) * t) / (1 - time)
    : lerp(1 + power, 1, eases.outBounce((t - (1 - time)) / time));

// WHERE A BEAT AIMS: a 45° grid, so the rig strikes machine-square poses. Usually into the
// far half of the range, but ALWAYS crossing over is its own monotony, so it may instead
// take the WHOLE range and reach the near-side angles too. `stale` = targets played lately
// — the grid alphabet is SHORT (a [-60, 0] knee has two words), so a channel that does not
// deliberately look elsewhere just alternates.
const GRID = 45;
const NEAR_CHANCE = 0.35;   // odds a beat takes a shorter move instead of crossing
const MIN_TRAVEL = 0.15;    // shortest move worth making, as a fraction of the range
function target(rnd, from, min, max, stale) {
  const mid = (min + max) / 2;
  const [flo, fhi] = from < mid ? [mid, max] : [min, mid];        // the far half
  const [lo, hi] = rnd() < NEAR_CHANCE ? [min, max] : [flo, fhi];
  const reach = MIN_TRAVEL * (max - min);
  const grid = [];
  for (let g = Math.ceil(lo / GRID) * GRID; g <= hi + 1e-9; g += GRID)
    if (Math.abs(g - from) >= reach) grid.push(g);
  const fresh = grid.filter((g) => !stale?.has(g));
  if (fresh.length) return pick(rnd, fresh);
  if (grid.length) return pick(rnd, grid);
  // NO GRID ANGLE FITS — a short range like hip level. Draw FREELY instead, anywhere
  // further than `reach` away: the dead zone already guarantees a real move, and keeping
  // the far-half rule too would pen the channel into two bands and metronome between them.
  const gap = [[min, from - reach], [from + reach, max]].filter(([a, b]) => b > a);
  if (!gap.length) return lerp(flo, fhi, rnd());
  const width = gap.reduce((w, [a, b]) => w + (b - a), 0);
  let at = rnd() * width;                            // uniform across the free room
  for (const [a, b] of gap) {
    if (at < b - a) return a + at;
    at -= b - a;
  }
  return gap.at(-1)[1];
}

// Fisher-Yates prefix: `n` distinct entries out of the pool
function sample(rnd, pool, n) {
  const a = [...pool];
  for (let i = 0; i < n; i++) {
    const j = i + ((rnd() * (a.length - i)) | 0);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
const pick = (rnd, pool) => pool[(rnd() * pool.length) | 0];

/**
 * @param sliders  [{ key, min, max, big }] — `big` marks the root-near bones
 * @param home     rest pose the rig occasionally snaps back to
 * @param montages { name: { setup, keys: [{ pose, hold, ease }], loops } } routines
 * @param exclusives [[key, ...]] — channels sharing one joint, of which only one may be
 *                 off its rest pose at a time
 * @param grounded [[[key, ...], ...]] — groups of channel SETS (the atlas's two legs), of
 *                 which at least one must sit at rest at EVERY instant, so the figure
 *                 never leaves the floor
 * @param pulse    [key, ...] — WHOLE-BODY channels with their own slot in the beat instead
 *                 of competing for the one `move` (the atlas's hip level)
 * @param spin     key — the channel a MOVELESS style turns on instead (the atlas's waist
 *                 twist): linear, across the whole period, under the anticts
 * @param twin     key -> key | null. The channel that must follow this one (the right
 *                 flank, while mirrored). DRIVEN to the same target rather than handed the
 *                 value, so it eases over from where it stands instead of snapping
 * @param parked   [key, ...] — channels the beat never picks AND never leaves off rest; a
 *                 beat finding one adrift walks it home. For channels the caller takes out
 *                 of the rig mid-dance (mirroring on, which grounds both legs)
 * @param onSwitch called at a beat instead of moving, to rewire the rig. The caller hands
 *                 the pose to a FRESH choreographer, so this one just holds; which way the
 *                 flip goes is read off `twin` (`splitChance` / `mergeChance`)
 * @param grid     seconds per TICK a step may begin or end on. 0 = free timing
 * @param timing   any CHOREO_TIMING key, overriding its default
 */
export function createChoreographer(
  sliders,
  { home = {}, montages = {}, exclusives = [], grounded = [], parked = [], pulse = [],
    spin = null, twin = null, onSwitch = null, style: styleName = null, seed = 1, grid = 0,
    ...timing } = {},
) {
  const {
    period, anticRatio, restRatio, bounceTime, bouncePower,
    styleBeats, pulseChance, splitChance, mergeChance,
  } = { ...CHOREO_TIMING, ...timing };
  const switchChance = twin ? splitChance : mergeChance;
  const hit = moveBounce(bounceTime, bouncePower);
  // A BEAT LANDS ON THE DOWNBEAT AT THE END OF IT: the dead slice is spent FIRST, so the
  // landing falls on the period boundary, where the music puts its kick. The other way
  // round the rig starts moving on the kick and settles mid-bar — off the beat. `mainAt`
  // is snapped to a TICK: a home snap cuts every channel at once, so off-grid it is the
  // whole rig lurching between two 16ths.
  const tick = (t) => (grid ? Math.round(t / grid) * grid : t);
  const mainAt = tick(restRatio * period);
  const mainDur = period - mainAt;
  const STEP_SHARE = {
    antic: anticRatio,
    move: (1 - restRatio - anticRatio) * (1 - bounceTime),
    bounce: (1 - restRatio - anticRatio) * bounceTime,
    rest: restRatio,
  };

  // THE GRID. Raw, a style's steps hand over BETWEEN the notes, and every handover is a
  // visible accent. So they are snapped to whole ticks by LARGEST REMAINDER — floor each
  // step (min one tick), deal the leftovers to the biggest remainders — which invents and
  // loses nothing, so the last step still ends flush on the boundary.
  const snap = (durs, total) => {
    if (!grid) return durs;
    const ticks = Math.round(total / grid);
    if (ticks < durs.length) return durs;         // finer than the grid: leave it alone
    const raw = durs.map((d) => d / grid);
    const out = raw.map((r) => Math.max(1, Math.floor(r)));
    let left = ticks - out.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => [r - Math.floor(r), i])
      .sort((a, b) => b[0] - a[0])
      .map(([, i]) => i);
    for (let k = 0; left > 0; k++, left--) out[order[k % order.length]]++;
    // and take them back off the longest steps if the floors overshot, which they can when
    // a step was rounded up to its one-tick minimum
    for (let k = 0; left < 0; k++, left++) {
      const from = out.indexOf(Math.max(...out));
      out[from]--;
    }
    return out.map((n) => n * grid);
  };

  const rnd = mulberry32(seed);
  const pulsed = new Set(pulse);
  const small = sliders.filter((s) => !s.big && !pulsed.has(s.key));
  const big = sliders.filter((s) => s.big && !pulsed.has(s.key));
  const pulses = sliders.filter((s) => pulsed.has(s.key));
  const spinner = sliders.find((s) => s.key === spin) ?? null;
  const routines = Object.values(montages);
  const rest = (key) => home[key] ?? 0;
  const rivals = {};
  for (const g of exclusives) for (const k of g) rivals[k] = g.filter((x) => x !== k);
  // key -> every channel of the OTHER sets in its grounded group. Where `rivals` is a rule
  // the beat ENFORCES (park the losers as you move), this is one it OBEYS.
  const anchors = {};
  for (const g of grounded)
    for (const set of g)
      for (const k of set) anchors[k] = g.filter((s) => s !== set).flat();
  // Anchors must hold rest at EVERY INSTANT: at rest where the beat starts (`was`) and not
  // stirred since. Where the plan LEAVES them is not enough — a beat that swings leg L out
  // and walks it home again both starts and ends with L at rest, and would gladly lift leg
  // R alongside that walk home. A leg still coming down is a leg in the air.
  const allowed = (was, stirred, key) =>
    !anchors[key] || anchors[key].every((k) => was[k] === rest(k) && !stirred.has(k));

  let clock = 0, span = 0;   // time into the current beat, and its length
  let tracks = [];
  let queued = null;         // a montage the caller asked for by hand
  let cued = false;          // the beat has been told to end here, wherever it had got to
  let style = null, styleLeft = 0;
  let pinned = STYLES.find((s) => s.join("-") === styleName) ?? null;   // null = draw at random

  // WHAT THE DANCE JUST DID, and should not do again yet. Neither is a ban: with nothing
  // else on offer the beat still plays it.
  const MEMORY = 2;
  const played = new Map();          // key -> the targets it has lately been sent to
  let busy = new Set();              // channels the previous beat moved
  const remember = (key, to) => {
    let hist = played.get(key);
    if (!hist) played.set(key, (hist = []));
    hist.push(to);
    if (hist.length > MEMORY) hist.shift();
  };
  const aim = (rnd, s, cur) => {
    const to = target(rnd, cur[s.key], s.min, s.max, new Set(played.get(s.key)));
    remember(s.key, to);
    return to;
  };
  const draw = (rnd, pool, n) => {
    const rested = pool.filter((s) => !busy.has(s.key));
    return sample(rnd, rested.length >= n ? rested : pool, n);
  };

  // A montage is a KEYFRAME timeline: setup pose, then keys in order, each a partial pose
  // plus the `hold` (in beats) it takes to reach it.
  //
  // IT IS FITTED TO THE BEAT. A routine's holds add up to whatever they add up to — 2.6
  // beats, 3.3 — and danced raw it would end off the beat and knock every beat after it off
  // too. So they are STRETCHED by one common factor onto the nearest WHOLE number of beats:
  // the rhythm is kept exactly, only the absolute tempo gives.
  const montage = (cut, { setup, keys, loops = 1, ease = eases.inOutSine }) => {
    const held = keys.reduce((sum, k) => sum + (k.hold ?? 0.35), 0) * loops;
    const raw = SETUP_RATIO + held;                     // what the routine asks for, in beats
    const beats = Math.max(1, Math.round(raw));         // what it gets
    // the setup is the run-up, so the stretch falls entirely on the keys, where the
    // rhythm lives. Nothing is held back for a tail: the LAST KEY ENDS ON THE DOWNBEAT.
    const fit = held > 0 ? (beats - SETUP_RATIO) / held : 1;
    const at = tick(SETUP_RATIO * period);
    // one snap over the WHOLE timeline, not one per loop, so the ticks the rounding gives
    // and takes stay inside it and the run still ends flush on the boundary
    const runs = Array.from({ length: loops }, () => keys).flat();
    const durs = snap(runs.map((k) => (k.hold ?? 0.35) * fit * period), beats * period - at);
    let t = at;
    for (const [key, to] of Object.entries(setup)) cut(key, to, 0, at, hit);
    runs.forEach((k, i) => {
      for (const [key, to] of Object.entries(k.pose)) cut(key, to, t, durs[i], k.ease ?? ease);
      t += durs[i];
    });
    return beats * period;
  };

  const snapHome = (cut, cur) => {
    for (const s of sliders) cut(s.key, home[s.key] ?? cur[s.key], mainAt, mainDur, hit);
    return period;
  };

  // AN IMPROVISED BEAT: the current style's steps, laid end to end. `cur` is live under the
  // cuts, so an antic that lifts a leg blocks the other one for every step after it.
  const improvise = (was, stirred, cur, cut) => {
    // the style is HELD, then swapped for ANOTHER one — redrawing the same style would
    // read as no switch at all. A pinned style never rotates.
    if (styleLeft <= 0) {
      style = pinned ?? pick(rnd, STYLES.filter((s) => s !== style));
      styleLeft = Math.max(1, styleBeats);
    }
    styleLeft--;

    const moved = new Set();   // what this beat picks, and what the next one avoids

    // THE PULSE — a whole-body channel travelling under the steps rather than among them.
    // No bounce (a body settling onto its legs does not ring), so it never overshoots and a
    // channel already at the end of its range still moves.
    for (const s of pulses)
      if (rnd() < pulseChance && allowed(was, stirred, s.key)) {
        cut(s.key, aim(rnd, s, cur), 0, period, eases.inOutSine);
        moved.add(s.key);
      }

    // THE SPIN — a style with no `move` in it has no travel: the anticts are all leaves
    // flicking, and nothing carries the beat. So the spin channel does, TURNING under them
    // the way the pulse rides under a normal beat: linear, no bounce, the whole period long,
    // so the body is still coming round as the beat lands.
    if (spinner && !style.includes("move") && allowed(was, stirred, spinner.key)) {
      cut(spinner.key, aim(rnd, spinner, cur), 0, period, eases.linear);
      moved.add(spinner.key);
    }

    // ROTATE THE TRAILING `rest` TO THE FRONT. It is DEAD TIME, so danced where it is
    // written the rig arrives early and waits out the bar, missing the downbeat by whatever
    // rest the style carries. At the front it becomes the hold after the LAST beat's
    // landing, and what is left ends flush on the period boundary — the downbeat.
    const steps = [...style];
    while (steps.length > 1 && steps.at(-1) === "rest") steps.unshift(steps.pop());

    const scale = period / steps.reduce((sum, kind) => sum + STEP_SHARE[kind], 0);
    const durs = snap(steps.map((kind) => STEP_SHARE[kind] * scale), period);
    let t = 0;
    let reel = null;   // the move aimed past its target, waiting on the bounce to land it
    steps.forEach((kind, i) => {
      const dur = durs[i];
      if (kind === "antic") {
        const n = 1 + ((rnd() * Math.min(3, small.length)) | 0);
        for (const s of draw(rnd, small, n))
          if (allowed(was, stirred, s.key)) {
            cut(s.key, aim(rnd, s, cur), t, dur, eases.linear);
            moved.add(s.key);
          }
      } else if (kind === "move") {
        // draw from the channels still open, rather than drawing blind and losing the move
        // when it lands on a leg the figure is standing on
        const open = big.filter((s) => allowed(was, stirred, s.key));
        if (open.length) {
          const s = draw(rnd, open, 1)[0];
          const to = aim(rnd, s, cur);
          // aim PAST it, and leave the target for the bounce to land
          cut(s.key, to + bouncePower * (to - cur[s.key]), t, dur, eases.linear);
          reel = { key: s.key, to };
          moved.add(s.key);
        }
      } else if (kind === "bounce" && reel) {
        cut(reel.key, reel.to, t, dur, eases.outBounce);
        reel = null;
      }
      t += dur;
    });
    busy = moved;
    return period;
  };

  // A plan is a track list plus the time it takes: a beat or a home snap fills one period,
  // a montage runs as long as it needs
  const plan = (pose) => {
    const was = { ...pose };   // where the beat STARTS, frozen: the grounded rule reads it
    const cur = { ...pose };   // shadows the pose as the plan is laid out, so a key
                               // written twice starts where the last leg left it
    // every channel taken off rest at ANY instant — one walked home later is still
    // stirred, and the grounded rule counts it
    const stirred = new Set();
    tracks = [];
    // Writing a channel TWICE in one window RE-AIMS the track already there rather than
    // laying a second over it. A second track would capture its `from` AFTER the first
    // claimed the target — reading from == to, sitting flat, and (applied last) TELEPORTING
    // the channel on the opening frame. A mirrored montage naming both flanks does this.
    const push = (key, to, t0, dur, ease) => {
      const laid = tracks.find((t) => t.key === key && t.t0 === t0);
      if (laid) Object.assign(laid, { to, dur, ease });   // keep the `from` it started at
      else tracks.push({ key, to, t0, dur, ease, from: cur[key] });
      if (to !== rest(key)) stirred.add(key);
      cur[key] = to;
    };
    // Channels sharing a joint pick targets independently, and three at full swing fold
    // the part through itself. So taking one off its rest parks its rivals back on
    // theirs, over the same window and ease: one clean rotation instead of a tangle.
    const cut = (key, to, t0, dur, ease) => {
      push(key, to, t0, dur, ease);
      // THE TWIN is DRIVEN over the same window, easing from wherever it actually sits.
      // Copying the value across as it lands would TELEPORT it: the moment the mirror
      // clamps on, the right arm is still wherever the split left it.
      const t = twin?.(key);
      if (t && t !== key) push(t, to, t0, dur, ease);
      if (to === rest(key)) return;
      for (const r of rivals[key] ?? [])
        if (cur[r] !== rest(r)) push(r, rest(r), t0, dur, ease);
    };
    // A parked channel can be handed over ADRIFT — the mirror clamps on with a leg still
    // in the air, and that leg is now out of the beat with nothing to bring it down. So
    // every beat, whatever else it is, first walks the parked channels home.
    for (const key of parked)
      if (cur[key] !== rest(key)) cut(key, rest(key), mainAt, mainDur, eases.inOutSine);
    if (queued) {
      const m = queued;
      queued = null;
      return montage(cut, m);
    }
    const roll = rnd();
    // now and then it snaps home, so the beats do not wander ever further from rest
    if (roll < HOME_CHANCE) return snapHome(cut, cur);
    if (roll < HOME_CHANCE + MONTAGE_CHANCE && routines.length)
      return montage(cut, sample(rnd, routines, 1)[0]);
    // and now and then it rewires: the pose carries over, so nothing moves on the beat
    // itself, and the next beats are planned on the new slider set
    if (onSwitch && roll < HOME_CHANCE + MONTAGE_CHANCE + switchChance) {
      onSwitch();
      return period;
    }
    return improvise(was, stirred, cur, cut);
  };

  const write = (pose, at) => {
    for (const t of tracks) {
      const u = (at - t.t0) / t.dur;
      if (u <= 0) continue;
      // no clamp: a target ON a range edge (arm fully raised, fist closed) would otherwise
      // have its overshoot flattened, and the bounce must swing past every time
      pose[t.key] = u >= 1 ? t.to : lerp(t.from, t.to, t.ease(u));
    }
  };

  return {
    /** advance the beat and write the rig pose in place */
    step(dt, pose) {
      clock += dt;
      if (clock >= span || cued) {
        // LAND THE OUTGOING BEAT — draw it one last time AT ITS OWN END. A track ending
        // exactly at `span` never sees a frame at u >= 1 (the rollover replans first), so
        // it is thrown away a hair short of its target. The hair is invisible, but the
        // rules compare the pose with `===`: a leg a hair short of rest is NOT at rest,
        // and the grounded rule then strands both legs forever.
        // A cue near that end IS the beat ending; a cue far from it is a real resync, and
        // there the beat is dropped WHERE IT STANDS — snapping to targets it never danced
        // would teleport the rig.
        write(pose, span - clock < NEAR_END ? span : clock);
        clock = clock >= span ? clock - span : 0;
        cued = false;
        span = plan(pose);
      }
      write(pose, clock);
    },
    /** run a montage by name at the next beat, cutting the current one short */
    play(name) {
      if (!montages[name]) return;
      queued = montages[name];
      cued = true;   // the running beat ends here
    },
    /** cut the running beat short, so the next step plans a fresh one */
    cue() { cued = true; },
    /** the length of the beat now playing, in seconds */
    get span() { return span; },
    /** the style being danced right now, as its step list */
    get style() { return style; },
  };
}
