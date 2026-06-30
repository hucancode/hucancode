// Design engine public surface. Takes a rig ({ bones, meta }) from the rig engine
// and returns a primitive list for the render engine. Imports neither engine's
// internals beyond the rig data contract.
export { rigToPrimitives } from "./generate.js";
export { jointCatalog, JOINT_BUILDERS, JOINT_NAMES, JOINT_PARAMS } from "./joints.js";
export { PALETTE } from "./palette.js";
