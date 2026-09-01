import { INSTANCED_MODULE, INSTANCED_OPTS } from "$lib/mech/instancing.js";
import GLYPH from "./shaders/glyph.wgsl?shader";
import ENSO from "./shaders/enso.wgsl?shader";
import STROKE from "./shaders/stroke.wgsl?shader";
import HEAD from "./shaders/head.wgsl?shader";
import GRID from "./shaders/grid.wgsl?shader";
import LINE from "./shaders/line.wgsl?shader";

const mk = (module, opts) => ({ module, opts });

export const PROGRAMS = {
  glyph: mk(GLYPH, { blend: "straight", topology: "tri-strip" }),
  enso: mk(ENSO, { blend: "straight", topology: "tri-strip" }),
  // stroke: position (loc 0) and line-uv (loc 1) in SEPARATE vertex buffers
  stroke: mk(STROKE, { blend: "straight", topology: "tri" }),
  // head: position + uv INTERLEAVED in one vertex buffer
  head: mk(HEAD, {
    blend: "straight",
    topology: "tri-strip",
    layout: { vertex: { inputs: ["aPos", "aUV"] } },
  }),
  grid: mk(GRID, { blend: "premult", topology: "tri-strip" }),
  mechDragon: mk(INSTANCED_MODULE, {
    ...INSTANCED_OPTS,
    blend: "straight",
    depth: true,
    topology: "tri",
  }),
  line: mk(LINE, { blend: "straight", topology: "line-strip" }),
  point: mk(LINE, { blend: "straight", topology: "point" }),
};
