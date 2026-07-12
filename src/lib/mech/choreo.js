// CHOREOGRAPHER — procedural beat generator for a slider-driven rig.
//
// Every `period` seconds it plans a beat, and mutates the pose object in place —
// so whatever binds those sliders (a playground's range inputs) tracks the motion
// for free. Targets are captured from the pose at plan time, so a beat always
// starts wherever the last one, or the user's own dragging, left off.
//
// Usually the beat is improvised, and an improvised beat is a STYLE: a short list
// of steps laid end to end across the period. Four kinds of step —
//   antic  1-3 SMALL sliders (leaf-near: elbows, wrists, fingers) ramp to new
//          targets, dead linear, so the extremities read as leading
//   move   1 BIG slider (root-near: waist, shoulder, neck) travels, aimed PAST
//          its target for the bounce to reel back in
//   bounce reels that move down onto the target it overshot
//   rest   the rig holds what it is wearing
// so styles differ in ATTACK, not vocabulary, and the same knobs time all of them.
//
// Sometimes it plans something rehearsed instead: every slider bounces home to the
// rest pose, or a MONTAGE runs — a setup pose struck with the same bounce, then a
// keyframe timeline played through. A montage owns the clock while it lasts.
import { mulberry32 } from "$lib/math/random.js";
import { eases } from "$lib/math/ease.js";
import { lerp } from "$lib/math/scalar.js";

// The beat's shape. A period splits into an anticipation slice, the main move and
// a tail holding the new pose; the move spends its closing `bounceTime` bouncing.
export const CHOREO_TIMING = {
  period: 1.5,        // seconds between beats
  anticRatio: 0.18,   // leading slice the small sliders ramp across
  restRatio: 0.2,     // trailing slice, everything already settled
  bounceTime: 0.2,    // closing slice of the main move the bounce occupies
  bouncePower: 0.1,   // how far the travel aims past its target, as a fraction of
                      // the distance it covers
  styleBeats: 10,     // beats a style is danced before another is drawn
  pulseChance: 0.15,  // odds a beat travels a PULSE channel (see `pulse`) — low, so
                      // the body sinks now and then rather than pumping every beat
  switchChance: 0.08, // odds a beat rewires the rig instead of moving it (only
                      // where the caller offers an `onSwitch`)
};
const HOME_CHANCE = 0.05;      // odds a beat is a snap back to the rest pose
const MONTAGE_CHANCE = 0.1;    // odds a beat is a rehearsed montage instead
const SETUP_RATIO = 0.8;       // beats a montage spends striking its setup pose

// The styles, as step lists. The first is the plain one — anticipate, swing,
// bounce onto it, hold; the others deal the same steps in another order. A move
// is always REELED IN by the bounce after it, and a bounce always has a move to
// reel: the two are one gesture dealt as two steps. A style is HELD for
// `styleBeats`, so the rig reads as dancing one figure and then changing its mind.
const STYLES = [
  ["antic", "move", "bounce", "rest"],
  ["antic", "antic", "move", "bounce"],
  ["antic", "antic", "antic", "rest"],
];
// a style's name IS its steps: the caller pins one by naming it, and shows the
// same string back to whoever is watching
export const CHOREO_STYLES = STYLES.map((s) => s.join("-"));

// an ease like any other, except it leaves [0,1] on the way: constant speed out
// past the target, then outBounce hauls it back to exactly 1
const moveBounce = (time, power) => (t) =>
  t < 1 - time
    ? ((1 + power) * t) / (1 - time)
    : lerp(1 + power, 1, eases.outBounce((t - (1 - time)) / time));

// WHERE A BEAT AIMS. Targets sit on a 45° grid, so the rig strikes machine-square
// poses. Usually it aims into the half of the range furthest from where the slider
// sits, so the beat reads as a real move — but ALWAYS crossing over is its own
// monotony: from a raised arm the only way is down, and the dance swings end to
// end forever. So a beat may instead take the WHOLE range, which reaches the grid
// angles on the near side too (90 -> 45, not only 90 -> -90). The target must
// still lie MIN_TRAVEL of the range away, so a beat never merely fidgets.
const GRID = 45;
const NEAR_CHANCE = 0.35;   // odds a beat takes a shorter move instead of crossing
const MIN_TRAVEL = 0.15;    // shortest move worth making, as a fraction of the range
// `stale` = the targets this channel has played lately, which are passed over while
// anything else is on offer. On a 45° grid a channel's alphabet is SHORT — a knee
// with a [-60, 0] range has two words in it — so without this a channel just
// alternates, and the dance sounds like it is repeating even when the beats differ.
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
  // NO GRID ANGLE FITS — a short range like hip level, whose whole span holds none.
  // Such a channel draws FREELY, anywhere in its WHOLE range that is more than
  // `reach` from where it stands: the dead zone alone already guarantees a real
  // move, so there is nothing for the far-half rule to buy, and obeying it would
  // pen the channel into two bands and metronome between them — deep, shallow,
  // deep, shallow.
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

// Fisher-Yates prefix: `n` distinct entries out of the pool.
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
 * @param exclusives [[key, ...]] — channels sharing one joint, of which only one
 *                 may be off its rest pose at a time
 * @param grounded [[[key, ...], ...]] — groups of channel SETS (the atlas's two
 *                 legs), of which at least one set must sit at rest at EVERY
 *                 instant, so the figure never leaves the floor
 * @param pulse    [key, ...] — WHOLE-BODY channels that get their own slot in the
 *                 beat instead of competing with the limbs for the one `move`:
 *                 each may travel across the whole period, on its own odds. The
 *                 atlas's hip level, so the figure sinks and rises while it dances
 * @param twin     key -> key | null. The channel that must follow this one: the
 *                 atlas's right flank while it mirrors the left. It is DRIVEN to
 *                 the same target rather than handed the value, so it eases over
 *                 from wherever it stands instead of snapping
 * @param parked   [key, ...] — channels the beat never picks AND never leaves off
 *                 their rest pose: a beat finding one adrift walks it home. A
 *                 caller taking channels out of the rig mid-dance (the atlas
 *                 clamping its mirror on, grounding both legs) hands them over here
 * @param onSwitch called at a beat instead of moving, to rewire the rig (the atlas
 *                 flipping mirrored <-> split). The caller hands the new pose to a
 *                 FRESH choreographer, so this one just holds
 * @param timing   any CHOREO_TIMING key, overriding its default
 */
export function createChoreographer(
  sliders,
  { home = {}, montages = {}, exclusives = [], grounded = [], parked = [], pulse = [],
    twin = null, onSwitch = null, style: styleName = null, seed = 1, ...timing } = {},
) {
  const {
    period, anticRatio, restRatio, bounceTime, bouncePower,
    styleBeats, pulseChance, switchChance,
  } = { ...CHOREO_TIMING, ...timing };
  const hit = moveBounce(bounceTime, bouncePower);
  const mainAt = anticRatio * period;
  const mainDur = (1 - restRatio - anticRatio) * period;
  // what each step is WORTH, as a share of a beat — read straight off the timing
  // knobs, so the plain style times exactly as it always did (its four shares sum
  // to the period) and any other style shares the period out in the same ratios
  const STEP_SHARE = {
    antic: anticRatio,
    move: (1 - restRatio - anticRatio) * (1 - bounceTime),
    bounce: (1 - restRatio - anticRatio) * bounceTime,
    rest: restRatio,
  };

  const rnd = mulberry32(seed);
  const pulsed = new Set(pulse);
  // a pulse channel is nobody's antic or move: it has its own slot in the beat
  const small = sliders.filter((s) => !s.big && !pulsed.has(s.key));
  const big = sliders.filter((s) => s.big && !pulsed.has(s.key));
  const pulses = sliders.filter((s) => pulsed.has(s.key));
  const routines = Object.values(montages);
  const rest = (key) => home[key] ?? 0;
  // key -> the channels that must sit at rest while it is off its own
  const rivals = {};
  for (const g of exclusives) for (const k of g) rivals[k] = g.filter((x) => x !== k);
  // key -> every channel of the OTHER sets in its grounded group: the ones that
  // must be resting before this key may be picked at all. Where `rivals` is a rule
  // the beat ENFORCES (park the losers as you move), this is one it OBEYS (never
  // pick a channel that would lift the last standing leg).
  const anchors = {};
  for (const g of grounded)
    for (const set of g)
      for (const k of set) anchors[k] = g.filter((s) => s !== set).flat();
  // A channel may be picked only if the sets anchoring it hold their rest pose at
  // EVERY INSTANT: sitting at rest where the beat starts (`was`), and never stirred
  // off it by a step since. Reading where the plan LEAVES them is not enough — a
  // beat that swings leg L out in one step and walks it home in another both starts
  // and ends with L at rest, and would gladly lift leg R alongside that walk home.
  // A leg the beat is still bringing down is a leg in the air.
  const allowed = (was, stirred, key) =>
    !anchors[key] || anchors[key].every((k) => was[k] === rest(k) && !stirred.has(k));

  let clock = 0, span = 0;   // time into the current beat, and its length
  let tracks = [];
  let queued = null;         // a montage the caller asked for by hand
  let style = null, styleLeft = 0;
  let pinned = STYLES.find((s) => s.join("-") === styleName) ?? null;   // null = draw at random

  // WHAT THE DANCE JUST DID, and therefore what it should not do again yet. The
  // grid alphabet is short, so the same handful of poses come round fast unless the
  // beat deliberately looks elsewhere: `played` remembers the last MEMORY targets of
  // each channel (so a knee stops flipping between its only two), and `busy` the
  // channels the last beat moved (so a joint gets a beat off before it is picked
  // again). Neither is a ban — if nothing else is on offer, the beat still plays it.
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
  // draw `n` channels, passing over the ones the last beat already used
  const draw = (rnd, pool, n) => {
    const rested = pool.filter((s) => !busy.has(s.key));
    return sample(rnd, rested.length >= n ? rested : pool, n);
  };

  // A montage is a KEYFRAME timeline: the setup pose is struck like any main move,
  // then the keys play in order. Each key is a partial pose plus the `hold` — in
  // beats — it takes to reach it, so a routine can dwell on one frame and flick
  // through the next; channels a key does not name hold what the last one left.
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

  // every slider drops what it is doing and bounces back to the rest pose
  const snapHome = (cut, cur) => {
    for (const s of sliders) cut(s.key, home[s.key] ?? cur[s.key], mainAt, mainDur, hit);
    return period;
  };

  // AN IMPROVISED BEAT: the current style's steps, laid end to end. A big slider is
  // spent once per beat, so back-to-back moves travel through two joints instead of
  // arguing over one. `cur` is live under the cuts, so a channel the grounded rule
  // blocks is simply skipped — and an antic that lifts a leg blocks the other one
  // for every step that follows in the same beat.
  const improvise = (was, stirred, cur, cut) => {
    // the style is HELD, then swapped for ANOTHER one — redrawing the same style
    // would read as no switch at all. A style pinned by the caller never rotates.
    if (styleLeft <= 0) {
      style = pinned ?? pick(rnd, STYLES.filter((s) => s !== style));
      styleLeft = Math.max(1, styleBeats);
    }
    styleLeft--;

    const moved = new Set();   // what this beat picks, and what the next one avoids

    // THE PULSE — a whole-body channel travelling across the WHOLE beat, under the
    // steps rather than among them: the hips sink while the arms keep dancing. It
    // eases in and out (no bounce: a body settling onto its legs does not ring), and
    // it never overshoots, so a channel already at the end of its range still moves.
    for (const s of pulses)
      if (rnd() < pulseChance && allowed(was, stirred, s.key)) {
        cut(s.key, aim(rnd, s, cur), 0, period, eases.inOutSine);
        moved.add(s.key);
      }

    const scale = period / style.reduce((sum, kind) => sum + STEP_SHARE[kind], 0);
    let t = 0;
    let reel = null;   // the move aimed past its target, waiting on the bounce to land it
    style.forEach((kind) => {
      const dur = STEP_SHARE[kind] * scale;
      if (kind === "antic") {
        const n = 1 + ((rnd() * Math.min(3, small.length)) | 0);
        for (const s of draw(rnd, small, n))
          if (allowed(was, stirred, s.key)) {
            cut(s.key, aim(rnd, s, cur), t, dur, eases.linear);
            moved.add(s.key);
          }
      } else if (kind === "move") {
        // draw from the channels still open, rather than drawing blind and losing
        // the move when it lands on a leg the figure is standing on
        const open = big.filter((s) => allowed(was, stirred, s.key));
        if (open.length) {
          const s = draw(rnd, open, 1)[0];
          const to = aim(rnd, s, cur);
          // aim PAST it, dead linear, and leave the target for the bounce to land
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

  // A plan is a track list plus the time the whole thing takes: an improvised beat
  // and a home snap each fill one period, a montage runs as long as it needs.
  const plan = (pose) => {
    const was = { ...pose };   // where the beat STARTS, frozen: the grounded rule reads it
    const cur = { ...pose };   // shadows the pose as the plan is laid out, so a key
                               // written twice starts where the last leg left it
    // every channel this beat takes off its rest pose, at ANY instant — a channel
    // walked home later is still stirred, and the grounded rule counts it
    const stirred = new Set();
    tracks = [];
    // Writing a channel TWICE in one window re-aims the track already there; it does
    // not lay a second one over the top. A second track would carry its own `from`,
    // captured after the first already claimed the target — so it would read
    // from == to, sit flat on the target for the whole window and (being applied
    // last) TELEPORT the channel there on the opening frame. A mirrored montage does
    // exactly that: it names the left channel, whose twin drives the right, and then
    // names the right one itself.
    const push = (key, to, t0, dur, ease) => {
      const laid = tracks.find((t) => t.key === key && t.t0 === t0);
      if (laid) Object.assign(laid, { to, dur, ease });   // keep the `from` it started at
      else tracks.push({ key, to, t0, dur, ease, from: cur[key] });
      if (to !== rest(key)) stirred.add(key);
      cur[key] = to;
    };
    // Channels sharing a joint pick their targets independently, and three of them
    // at full swing fold the part through itself. So only one channel of an
    // exclusive group may be off its rest: taking one off parks its rivals back on
    // theirs, over the same window and ease, and the joint reads as one clean
    // rotation instead of a tangle.
    const cut = (key, to, t0, dur, ease) => {
      push(key, to, t0, dur, ease);
      // THE TWIN. A mirrored rig names one flank and the other must follow — by
      // being DRIVEN over the same window, easing from wherever it actually sits.
      // Copying the value across as it lands would TELEPORT it: the moment the
      // mirror clamps on, the right arm is still wherever the split left it.
      const t = twin?.(key);
      if (t && t !== key) push(t, to, t0, dur, ease);
      if (to === rest(key)) return;
      for (const r of rivals[key] ?? [])
        if (cur[r] !== rest(r)) push(r, rest(r), t0, dur, ease);
    };
    // A parked channel the rig was handed adrift — the atlas clamps its mirror on
    // with a leg still in the air, and that leg is now out of the beat with nothing
    // to bring it down. So every beat, whatever else it turns out to be, first walks
    // the parked channels home.
    for (const key of parked)
      if (cur[key] !== rest(key)) cut(key, rest(key), mainAt, mainDur, eases.inOutSine);
    if (queued) {
      const m = queued;
      queued = null;
      return montage(cut, m);
    }
    const roll = rnd();
    // now and then the rig drops everything and snaps home, so the improvised beats
    // do not wander ever further from the rest pose
    if (roll < HOME_CHANCE) return snapHome(cut, cur);
    if (roll < HOME_CHANCE + MONTAGE_CHANCE && routines.length)
      return montage(cut, sample(rnd, routines, 1)[0]);
    // and now and then it rewires itself — the atlas takes its flanks apart, or puts
    // them back together. The pose carries over, so nothing moves on the beat
    // itself; the next beats are simply planned on the new slider set.
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
        // no clamp on the way: the targets are already inside the slider range, and
        // a target sitting ON a range edge (arm fully raised, fist fully closed)
        // would otherwise have its overshoot flattened — the bounce has to swing
        // past every time, not only where there happens to be headroom
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
