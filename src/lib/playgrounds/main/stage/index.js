// Staging framework barrel. A "stage" is a timeline of independent BLOCKS wired by
// a dependency graph; blocks expose declarative property TRACKS and an imperative
// lifecycle, register themselves in a REGISTRY, and share a first-class CAMERA
// TRACK. See the individual modules for the contracts.

export { makeTimeline, makeStage } from "./timeline.js";
export { defineBlock, hasBlock, buildStage } from "./registry.js";
export { track, hold, tween, keyframes } from "./track.js";
export { createCameraTrack } from "./camera-track.js";
