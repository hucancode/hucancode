import { track } from "../stage/index.js";

export function createDragon3dBlock({ timing }) {
  return {
    name: "dragon3d",
    at: timing.d3Start,
    outputs: ["d3Alpha"],
    defaults(ctx) { ctx.d3Alpha = 0; },
    tracks: {
      d3Alpha: track.tween(0, 1, { dur: timing.d3Mid - timing.d3Start, ease: "smooth" }),
    },
  };
}
