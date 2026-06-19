// Dragon3d block: fades the 3D dragon in over the crossfade (B6), coincident with
// the still-solid 2D ink, then it loops forever. Persistent. The mesh draw params
// are written elsewhere (the dragon3d model writes _frame.dragon3d); this block
// only owns the opacity. (The glyph/enso fades are owned by their own blocks.)

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
