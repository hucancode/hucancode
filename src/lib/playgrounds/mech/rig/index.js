// Rig engine public surface. Outputs a skeleton ({ bones, meta }); the design
// engine consumes it. Neither the design nor render engine reaches the other way.
export { buildHumanoidRig, ARCHETYPES } from "./humanoid.js";
