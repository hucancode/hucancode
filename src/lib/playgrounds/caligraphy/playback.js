// Stroke-reveal playback. pb.anim = render partially up to pb.t; false = full
// edit view. The clock is the host canvas's frame callback (tick), so playback
// pauses offscreen with the render loop instead of running its own RAF.
import { step } from "$lib/brush/engine";

export const makePlayback = () => ({ t: 0, playing: false, anim: false });

export function play(pb, total) {
  if (total <= 0) return;
  if (pb.t >= total) pb.t = 0; // replay from start
  pb.anim = true;
  pb.playing = true;
}

export const pause = (pb) => (pb.playing = false);

export const togglePlay = (pb, total) => (pb.playing ? pause(pb) : play(pb, total));

export function seek(pb, total, v) {
  pb.playing = false;
  pb.anim = true;
  pb.t = Math.max(0, Math.min(total, v));
}

export function exitAnim(pb) {
  pb.playing = false;
  pb.anim = false;
}

// step() clamps at `total` and clears pb.playing there.
export function tick(pb, dt, total) {
  if (pb.playing) step(pb, dt, total);
}
