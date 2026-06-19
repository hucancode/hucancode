// Staging framework barrel. A "stage" is a timeline of independent BLOCKS wired by
// a dependency graph; blocks expose declarative property TRACKS and an imperative
// lifecycle, and share a first-class CAMERA TRACK. See the individual modules for
// the contracts.

export { makeTimeline } from "./timeline.js";
export { track } from "./track.js";
export { createCameraTrack } from "./camera-track.js";
