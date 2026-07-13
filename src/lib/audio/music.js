// PROCEDURAL MUSIC — a seeded chiptune generator, and THE CLOCK everything else runs on.
//
// IT KNOWS NOTHING ABOUT ANY RIG. It publishes a clock — `quarter()`, the index of the
// quarter note being heard — and whatever dances to it works out its own steps. The two
// engines share that and NOTHING else: no imports, no rig concepts here.
//
// A TRACKER, not a song: a seeded draw picks key, scale and chord loop, and every SECTION
// (8 bars) redraws the patterns.
//
// WebAudio is scheduled, not polled — a note plays at `t` only if it was asked for before
// the hardware got there. So the sequencer runs LOOKAHEAD seconds ahead of the speaker,
// and `quarter()` reports the AUDIBLE past, not the written future.
import { mulberry32 } from "$lib/math/random.js";
import { clamp } from "$lib/math/scalar.js";
import { kick, snare, hat, bass, pulse, arp, crusher } from "./synth.js";

export const MUSIC_DEFAULTS = {
  bpm: 124,       // THE TEMPO, and the only clock in the playground
  gain: 0.5,      // master volume
  energy: 0.6,    // how busy the patterns are drawn: sparse dub -> everything at once
  swing: 0.15,    // how far the off-16ths lean late, as a fraction of half a step
  // the mixer: a layer switched off is simply not scheduled
  layers: { kick: true, snare: true, hats: true, bass: true, lead: true, chord: true },
};

const BEATS = 4;           // quarter notes in a bar
const STEPS = 16;          // 16th notes in a bar, so four to a quarter
const SECTION_BARS = 8;    // bars before the patterns are redrawn
const PHRASE_BARS = 4;     // bars in a phrase; the last one takes a fill
const LOOKAHEAD = 0.15;    // seconds of grid written onto the audio clock ahead of now
const TICK = 25;           // ms between scheduler wakeups

// ---- THE NOTES --------------------------------------------------------------
// Minor everywhere. The pentatonic cannot play a wrong note, which is what makes it safe
// to improvise a melody out of an RNG.
const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 3, 5, 7, 10],
};
// four-chord loops in SCALE DEGREES, always opening on the tonic, so a bar's chord reads
// straight off the bar counter and the loop always lands home
const PROGS = [
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [0, 6, 5, 4],
  [0, 4, 5, 3],
  [0, 0, 3, 4],
];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOTS = [33, 35, 36, 38, 40, 41, 43];   // MIDI, low A to low G: where the bass lives

const pick = (rnd, pool) => pool[(rnd() * pool.length) | 0];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
// a scale degree, wrapped: degree 7 of a 7-note scale is the tonic an octave up, and that
// carry is what lets a chord be built by stacking degrees
const noteOf = (scale, root, deg, oct = 0) => {
  const n = scale.length;
  const i = ((deg % n) + n) % n;
  return root + scale[i] + 12 * (Math.floor(deg / n) + oct);
};
// a TRIAD is every other degree. Major or minor third falls out of the SCALE rather than
// being chosen, so a chord built this way is always in key.
const triad = (deg) => [deg, deg + 2, deg + 4];

// ---- THE PATTERNS -----------------------------------------------------------
// A SECTION is one draw of every pattern; `energy` leans every roll. Patterns are drawn as
// SLOTS, not notes — the bass and lead hold which CHORD TONE to take, not which pitch — so
// the same pattern is re-voiced by whatever chord the bar is on, and the loop moves
// harmonically without the rhythm changing under it.
const drawSection = (rnd, energy) => {
  const e = clamp(energy, 0, 1);

  // FOUR ON THE FLOOR is the spine — a dancing figure needs to know where the beat is.
  const kicks = Array(STEPS).fill(0);
  for (const s of [0, 4, 8, 12]) kicks[s] = 1;
  for (const s of [3, 6, 7, 10, 14, 15]) if (rnd() < 0.3 * e) kicks[s] = 0.65;

  // the BACKBEAT, plus ghosts: the quiet hits between the loud ones are what makes a
  // pattern swing instead of march
  const snares = Array(STEPS).fill(0);
  snares[4] = snares[12] = 1;
  for (const s of [7, 10, 11, 14, 15]) if (rnd() < 0.35 * e) snares[s] = 0.3;

  // HATS carry the subdivision; the one open hat pulls the ear over the bar line
  const sixteenths = rnd() < e * 0.7;
  const hats = Array(STEPS).fill(null);
  for (let s = 0; s < STEPS; s++) {
    const on = sixteenths ? true : s % 2 === 1;
    if (!on) continue;
    hats[s] = { gain: s % 4 === 2 ? 0.35 : 0.2, open: false };
  }
  const openAt = rnd() < 0.6 ? 14 : 6;
  if (hats[openAt]) hats[openAt] = { gain: 0.3, open: true };

  // THE BASS. The root on the downbeat, always: that is what tells the ear the chord
  // changed. After that it walks the chord, with the odd octave jump.
  const bassline = Array(STEPS).fill(null);
  bassline[0] = { tone: 0, oct: 0, len: 2 };
  const density = 0.25 + 0.5 * e;
  for (let s = 1; s < STEPS; s++) {
    if (rnd() > density) continue;
    const off = s % 4 === 0;                       // on a quarter: take the root again
    bassline[s] = {
      tone: off ? 0 : (rnd() * 3) | 0,
      oct: rnd() < 0.18 ? 1 : 0,
      len: rnd() < 0.25 ? 2 : 1,
    };
  }

  // THE LEAD sits out about a third of the time, so the next section feels like something
  // happened. It repeats ONE motif: a melody redrawn every bar is noise with pitches.
  const leadOn = rnd() < 0.35 + 0.5 * e;
  const duty = pick(rnd, [0.125, 0.25, 0.5]);
  const motif = Array(STEPS).fill(null);
  if (leadOn) {
    const busy = 0.2 + 0.45 * e;
    for (let s = 0; s < STEPS; s++) {
      if (s % 2 === 1 && rnd() > busy * 0.5) continue;    // off-16ths stay rare
      if (rnd() > busy) continue;
      motif[s] = {
        deg: (rnd() * 5) | 0,                    // a degree of the chord, stacked upward
        oct: rnd() < 0.25 ? 1 : 0,
        len: rnd() < 0.3 ? 2 : 1,
        slide: rnd() < 0.12 ? pick(rnd, [-2, 2, 12]) : 0,
      };
    }
    motif[0] ??= { deg: 0, oct: 0, len: 2, slide: 0 };    // land the phrase on the beat
  }

  // THE CHORD, as an arpeggio, because the chip has no channel left to play it with
  const chordOn = rnd() < 0.75;

  return { kicks, snares, hats, bassline, motif, chordOn, duty, leadOn };
};

/**
 * @param seed    the draw: key, scale, progression and every pattern come off it
 * @param bpm/gain/energy/swing/layers  see MUSIC_DEFAULTS
 */
export function createMusic({ seed = 1, ...opts } = {}) {
  const cfg = { ...MUSIC_DEFAULTS, ...opts, layers: { ...MUSIC_DEFAULTS.layers, ...opts.layers } };
  const stepDur = () => 60 / cfg.bpm / (STEPS / BEATS);   // a 16th, at the tempo of the moment
  const barLen = () => (60 / cfg.bpm) * BEATS;

  let ctx = null;
  let timer = null;
  let master = null, drums = null, duck = null;
  let rnd, scale, scaleName, root, prog, section;
  let step = 0, bar = 0, stepAt = 0;
  // THE QUARTER NOTES already WRITTEN but not yet HEARD: each is queued with the audio time
  // it will sound at and its ABSOLUTE index, and `quarter()` reads the queue back against
  // the clock. The index is COUNTED, never computed from elapsed / beatLen — those agree
  // only while the tempo never changes. Counted, a tempo change just makes the next quarter
  // arrive sooner; computed, every quarter that ever played would silently renumber itself
  // and anything dancing to the count would lurch.
  let quarters = [];
  let count = 0;

  // THE DRAW. Key, scale and chord loop are the piece; the patterns on top are redrawn
  // every section. Re-seeding mid-dance is a KEY CHANGE: everything re-voices next bar.
  const draw = (s) => {
    rnd = mulberry32(s >>> 0);
    scaleName = pick(rnd, Object.keys(SCALES));
    scale = SCALES[scaleName];
    root = pick(rnd, ROOTS);
    prog = pick(rnd, PROGS);
    section = drawSection(rnd, cfg.energy);
  };
  draw(seed);

  // THE SIDECHAIN. Everything tonal is ducked by the kick, so the bass and the kick stop
  // fighting for the same bottom end and the track BREATHES on the pulse.
  const DUCK = 0.35, DUCK_BACK = 0.14;
  const duckAt = (t, amount) => {
    const g = duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(1 - DUCK * amount, t);
    g.linearRampToValueAtTime(1, t + DUCK_BACK);
  };

  const chordOf = (b) => triad(prog[b % prog.length]);

  // WHAT PLAYS AT ONE 16th. Nothing is DECIDED here — that was done when the section was
  // drawn — so this stays cheap enough to run inside the lookahead.
  const schedule = (s, t) => {
    const { kicks, snares, hats, bassline, motif, chordOn, duty } = section;
    const L = cfg.layers;
    const dur = stepDur();
    const chord = chordOf(bar);
    // THE FILL: the last bar of a phrase gives its second half to a snare roll into the
    // downbeat, which is how the ear knows a section is turning over
    const fill = bar % PHRASE_BARS === PHRASE_BARS - 1 && s >= 12;

    if (fill) {
      if (L.snare) snare(ctx, drums, t, { gain: 0.35 + 0.15 * (s - 12), decay: 0.08 });
      if (L.kick && s === 12) kick(ctx, drums, t, { gain: 1 }), duckAt(t, 1);
      if (L.hats && s === 15) hat(ctx, drums, t, { gain: 0.35, open: true });
    } else {
      if (L.kick && kicks[s]) {
        kick(ctx, drums, t, { gain: kicks[s] });
        // the pump goes with the kick that causes it: mute the drum and the bass stops
        // breathing at nothing
        duckAt(t, kicks[s]);
      }
      if (L.snare && snares[s]) snare(ctx, drums, t, { gain: snares[s] * 0.8 });
      if (L.hats && hats[s]) hat(ctx, drums, t, hats[s]);
    }

    const b = bassline[s];
    if (L.bass && b) {
      const note = noteOf(scale, root, chord[b.tone], b.oct);
      bass(ctx, duck, t, { freq: hz(note), dur: b.len * dur * 0.9, gain: 0.5 });
    }

    const m = motif[s];
    if (L.lead && m) {
      // the lead lives two octaves over the bass, where a chip lead lives
      const note = noteOf(scale, root, chord[0] + m.deg, m.oct + 2);
      pulse(ctx, duck, t, {
        freq: hz(note),
        dur: m.len * dur * 0.95,
        decay: m.len * dur * 0.95,
        gain: 0.22,
        duty,
        slide: m.slide,
        vibrato: m.len > 1 ? 12 : 0,
      });
    }

    if (L.chord && chordOn && s === 0) {
      const freqs = chord.map((d) => hz(noteOf(scale, root, d, 1)));
      arp(ctx, duck, t, { freqs, dur: barLen() * 0.95, gain: 0.1, duty: 0.5 });
    }
  };

  // THE SCHEDULER. The timer may be late, jittery, throttled by a background tab — none of
  // it reaches the music, because it never PLAYS anything, it only decides how far to write.
  const tick = () => {
    const now = ctx.currentTime;
    while (stepAt < now + LOOKAHEAD) {
      const dur = stepDur();                       // read live: a tempo drag takes effect here
      // a new section every SECTION_BARS: the patterns are redrawn, the key holds
      if (step === 0 && bar % SECTION_BARS === 0 && bar > 0)
        section = drawSection(rnd, cfg.energy);
      if (step % (STEPS / BEATS) === 0) quarters.push({ at: stepAt, i: count++ });
      // SWING: the off-16ths lean late. Dead-square 16ths sound like a machine — which the
      // robot is, so keep it subtle, but zero of it is a metronome.
      const late = step % 2 === 1 ? cfg.swing * dur * 0.5 : 0;
      schedule(step, stepAt + late);
      stepAt += dur;
      step = (step + 1) % STEPS;
      if (step === 0) bar++;
    }
  };

  const build = () => {
    ctx = new (window.AudioContext ?? window.webkitAudioContext)();
    master = ctx.createGain();
    duck = ctx.createGain();          // the tonal bus, pumped by the kick
    drums = ctx.createGain();         // ...which the drums bypass, so they punch through
    duck.gain.value = 1;
    drums.gain.value = 1;
    // the crusher makes it 8-bit; the limiter stops raw pulse from clipping the mix
    const crush = crusher(ctx, 5);
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    duck.connect(master);
    drums.connect(master);
    master.connect(crush).connect(limiter).connect(ctx.destination);
    master.gain.value = cfg.gain;
  };

  return {
    /** start the music. MUST be called from a user gesture: an AudioContext built
     *  outside one starts suspended and stays that way */
    start() {
      if (!ctx) build();
      ctx.resume();
      if (timer) return;
      step = 0;
      bar = 0;
      count = 0;
      quarters = [];
      stepAt = ctx.currentTime + 0.1;   // a beat of air, so the first bar is not late
      tick();
      timer = setInterval(tick, TICK);
    },
    stop() {
      clearInterval(timer);
      timer = null;
      quarters = [];
      ctx?.suspend();
    },
    /** live knobs: bpm, volume, energy, swing, layers. A tempo change lands on the next
     *  16th and an energy change on the next section — never mid-note */
    set(next = {}) {
      Object.assign(cfg, next, next.layers ? { layers: { ...cfg.layers, ...next.layers } } : {});
      if (master) master.gain.value = clamp(cfg.gain, 0, 1);
    },
    /** re-draw the key, the scale and the chord loop: a KEY CHANGE, mid-dance */
    reseed(s) {
      draw(s >>> 0);
    },
    /** THE CLOCK, and the whole of what this publishes: the index of the quarter note being
     *  HEARD right now (not the one being written — the scheduler runs ahead), or null
     *  before the first sounds. Anything dancing to it does its own arithmetic; the music
     *  never learns what it plays for. */
    quarter() {
      if (!ctx || !timer) return null;
      const now = ctx.currentTime;
      while (quarters.length > 1 && quarters[1].at <= now) quarters.shift();
      if (!quarters.length || quarters[0].at > now) return null;
      return quarters[0].i;
    },
    /** seconds per quarter note, for whatever is dancing to it to size its own steps */
    get beatLen() { return 60 / cfg.bpm; },
    get running() { return !!timer; },
    /** what it drew, for the panel to show: "A phrygian" */
    get key() { return `${NAMES[root % 12]} ${scaleName}`; },
  };
}
