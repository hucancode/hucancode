// Design engine public surface. The render engine never imports this; the page
// uses it to turn artistic params into a primitive list, then hands that list to
// the render engine.
export { generateMech, ARCHETYPES } from "./generate.js";
export { PALETTE } from "./palette.js";
