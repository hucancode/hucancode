// CHIPTUNE SYNTH — the voices, and nothing else. An NES chip, near enough: PULSE for the
// melody, TRIANGLE for the bass, NOISE for the drums. No samples, no files, no fetch.
//
// The 8-bit character is not the waveform, it is what the chip COULDN'T do — no filters,
// volume in 15 steps rather than slopes, one voice per channel (so a chord has to be an
// arpeggio). Keeping those limits is what keeps it off sounding like a modern synth.
//
// Every voice is ONE-SHOT: it writes its envelope onto the audio clock at `t` (in the
// FUTURE — the sequencer runs ahead of the speaker) and disconnects when the source ends.
import { mulberry32 } from "$lib/math/random.js";
import { clamp } from "$lib/math/scalar.js";

// ---- THE CHANNELS -----------------------------------------------------------
// A PULSE wave, as a Fourier series: harmonic n at duty d has amplitude
// (2 / n·pi)·sin(n·pi·d). Duty is the whole timbre of the chip, and the NES had these four.
const DUTIES = [0.125, 0.25, 0.5, 0.75];
const HARMONICS = 32;
const waves = new WeakMap();   // ctx -> duty -> PeriodicWave
const pulseWave = (ctx, duty) => {
  let byDuty = waves.get(ctx);
  if (!byDuty) waves.set(ctx, (byDuty = new Map()));
  let w = byDuty.get(duty);
  if (!w) {
    const real = new Float32Array(HARMONICS);
    const imag = new Float32Array(HARMONICS);
    for (let n = 1; n < HARMONICS; n++)
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    byDuty.set(duty, (w = ctx.createPeriodicWave(real, imag, { disableNormalization: false })));
  }
  return w;
};

// The NOISE channel: SAMPLE-AND-HOLD, not white noise — the chip clocked a shift register
// at a fixed rate, and that coarseness is what makes an 8-bit snare gravel, not air.
const NOISE_SECONDS = 2;
const NOISE_HOLD = 6;          // samples each random value is held for
const noises = new WeakMap();
const noise = (ctx) => {
  let buf = noises.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * NOISE_SECONDS, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const rnd = mulberry32(0x9e37);
    let v = 0;
    for (let i = 0; i < d.length; i++) {
      if (i % NOISE_HOLD === 0) v = rnd() < 0.5 ? -1 : 1;   // two levels, like the register
      d[i] = v;
    }
    noises.set(ctx, buf);
  }
  return buf;
};

// ---- THE ENVELOPE -----------------------------------------------------------
// THE STAIRCASE. The APU walked 15 volume levels, so a decaying note CLICKS down the steps
// instead of gliding: no ramps anywhere, only setValueAtTime, quantised to the ladder.
const LEVELS = 15;
const STAIR = 0.012;   // seconds a step is held: any longer and it turns into a tremolo
const quant = (v) => Math.round(clamp(v, 0, 1) * LEVELS) / LEVELS;
const stair = (amp, peak, t, decay, curve = 2) => {
  const steps = Math.max(1, Math.min(LEVELS, Math.round(decay / STAIR)));
  const g = amp.gain;
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    g.setValueAtTime(quant(peak * k ** curve), t + (i * decay) / steps);
  }
  g.setValueAtTime(0, t + decay);
};
// flat, then cut dead — the chip had no release, and that abruptness is why chiptune
// sounds so rhythmic
const hold = (amp, peak, t, dur) => {
  amp.gain.setValueAtTime(quant(peak), t);
  amp.gain.setValueAtTime(0, t + dur);
};
// a voice cuts itself out of the graph once its source has run: a node still wired to the
// output is a node still alive, and a dance is thousands of notes long
const sweep = (src, ...nodes) => {
  src.onended = () => { for (const n of nodes) n.disconnect(); };
};
const noiseSource = (ctx, rate = 1) => {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  src.playbackRate.value = rate;
  return src;
};

// ---- THE DRUMS --------------------------------------------------------------
// The NES had no drum channel: its drums were FAKED out of the tone and noise channels,
// which is why they sit in the same world as the melody instead of on top of it.

/** the four-on-the-floor spine: a triangle dropped down a cliff */
export function kick(ctx, out, t, { gain = 1, tune = 1, decay = 0.16 } = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "triangle";
  // THE PITCH DROP IS THE KICK: 220Hz to 45 in 50ms is a beater on a skin, the same
  // triangle held at 45 is a hum. Stepped, because the chip could not glide.
  const drops = 6;
  for (let i = 0; i < drops; i++) {
    const k = i / (drops - 1);
    osc.frequency.setValueAtTime((220 - 175 * k) * tune, t + k * 0.05);
  }
  stair(amp, gain, t, decay);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + decay + 0.01);
  sweep(osc, osc, amp);
}

/** backbeat: a noise burst for the rattle, a pulse under it for the drum */
export function snare(ctx, out, t, { gain = 1, decay = 0.12 } = {}) {
  const src = noiseSource(ctx, 1.2);
  const amp = ctx.createGain();
  stair(amp, gain, t, decay);
  src.connect(amp).connect(out);
  src.start(t);
  src.stop(t + decay + 0.01);
  sweep(src, src, amp);
  // THE BODY under the rattle: noise alone is a hiss with a shape, and this pitched thump
  // is what puts the snare in the same room as the kick
  const body = ctx.createOscillator();
  const bamp = ctx.createGain();
  body.setPeriodicWave(pulseWave(ctx, 0.5));
  body.frequency.setValueAtTime(190, t);
  body.frequency.setValueAtTime(140, t + 0.03);
  stair(bamp, gain * 0.4, t, decay * 0.6);
  body.connect(bamp).connect(out);
  body.start(t);
  body.stop(t + decay);
  sweep(body, body, bamp);
}

/** the grid you hear the tempo in. Noise read FAST, so it lands where a cymbal lives */
export function hat(ctx, out, t, { gain = 0.35, open = false } = {}) {
  const decay = open ? 0.14 : 0.03;
  const src = noiseSource(ctx, 3.2);
  const hp = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  // the ONE filter in the kit: coarse held noise carries too much bottom to sit under a
  // kick, so this takes it away and leaves the metal
  hp.type = "highpass";
  hp.frequency.value = 6000;
  stair(amp, gain, t, decay, 3);
  src.connect(hp).connect(amp).connect(out);
  src.start(t);
  src.stop(t + decay + 0.01);
  sweep(src, src, hp, amp);
}

// ---- THE TONE CHANNELS ------------------------------------------------------

/** the TRIANGLE channel: the bass. The chip could not set its volume — on or off — so
 *  this stays flat for the whole note and then stops dead */
export function bass(ctx, out, t, { freq, dur = 0.2, gain = 0.5 } = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t);
  hold(amp, gain, t, dur);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.01);
  sweep(osc, osc, amp);
}

/** a PULSE channel: the melody. `duty` is the timbre knob, `decay` walks the note down the
 *  volume ladder, `slide` bends the pitch — the chip's one expressive trick */
export function pulse(ctx, out, t, {
  freq, dur = 0.12, gain = 0.3, duty = 0.25, decay = null, slide = 0, vibrato = 0,
} = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.setPeriodicWave(pulseWave(ctx, duty));
  osc.frequency.setValueAtTime(freq, t);
  // a SLIDE in semitones, stepped: the pitch register was written per frame, so a glide
  // was a stair too
  if (slide) {
    const steps = 8;
    for (let i = 1; i <= steps; i++)
      osc.frequency.setValueAtTime(freq * 2 ** ((slide * i) / steps / 12), t + (i * dur) / steps);
  }
  // VIBRATO: an LFO on the pitch, what a tracker did to keep a long note from dying
  let lfo = null, lg = null;
  if (vibrato) {
    lfo = ctx.createOscillator();
    lg = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;         // in cents
    lfo.connect(lg).connect(osc.detune);
    lfo.start(t);
    lfo.stop(t + dur + 0.01);
    sweep(lfo, lfo, lg);
  }
  const len = decay ?? dur;
  if (decay) stair(amp, gain, t, decay);
  else hold(amp, gain, t, dur);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + len + 0.01);
  sweep(osc, osc, amp);
}

/** THE ARPEGGIO — a chord on a chip that has no chords. One voice FLICKERS through the
 *  tones faster than the ear can separate them, so it hears one buzzing chord. */
export function arp(ctx, out, t, {
  freqs, dur = 0.2, gain = 0.2, duty = 0.5, rate = 0.02,
} = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.setPeriodicWave(pulseWave(ctx, duty));
  const steps = Math.max(1, Math.round(dur / rate));
  for (let i = 0; i < steps; i++)
    osc.frequency.setValueAtTime(freqs[i % freqs.length], t + i * rate);
  hold(amp, gain, t, dur);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.01);
  sweep(osc, osc, amp);
}

// ---- THE MASTER BUS ---------------------------------------------------------
// A QUANTISER: the chip mixed into a handful of output levels, so everything came out
// with a crunch on it, and the same signal through a clean float bus is far too polite.
export function crusher(ctx, bits = 5) {
  const shaper = ctx.createWaveShaper();
  const n = 1 << bits;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.round(x * n) / n;
  }
  shaper.curve = curve;
  return shaper;
}
