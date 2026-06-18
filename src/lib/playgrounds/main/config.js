// Static tunables for the /paint scene. Pure data — no derived schedule times
// (those live in timing.js, since the branch time depends on the generated path
// length). Grouped by subsystem; every consumer imports the names it needs.

// ---- flight path -----------------------------------------------------------
export const LEADIN_DUR = 0.5;       // straight glide from the top onto the glyph start
export const LEADIN_START = { x: 0, y: 0.78 }; // top-middle, far from the glyph entry
export const GLYPH_TRACE_DUR = 3.5;  // head traces the whole glyph, leading the reveal
export const LEAD_OFFSET = 0.5;      // 2D dragon head leads the ink reveal (glyph + enso) by this many seconds
// 2D dragon glyph-trace exit: peels off the glyph onto the enso at the END of
// this baked-segment index (0-based). null / out-of-range -> the final segment.
export const GLYPH_EXIT_SEG = 45;
export const ENSO_LEADIN_DUR = 0.6;  // branch off the glyph end onto the enso (no snap)
export const ENSO_R = 0.4;           // enso radius (world units; <1 keeps it on-screen)
export const ENSO_WIDTH = 0.05;      // enso brush thickness (polar line width in the shader)
export const GROW_DUR = 2.5;         // body grows up after the glyph trace (over the enso)
export const ENTRY_GROW_MIN = 0.2;   // body length fraction while tracing the glyph
export const ENTRY_SIZE_MIN = 0.4;   // body width / head size fraction while tracing

// ---- 2D roam frame (rosette of tangent circles) ----------------------------
export const FRAME_SMALL_R = 0.5;          // vesica-lobe radius as a fraction of ENSO_R
export const FRAME_MEDIUM_N = 8;           // medium circles externally tangent to the enso
export const FRAME_MEDIUM_R = 0.7;         // medium radius as a fraction of ENSO_R (clamped)
export const FRAME_INNER_AXIS = Math.PI / 8; // vesica-pair axis (offset off the medium spokes)
export const FRAME_BRANCH_P = 0.5;         // chance to switch circles at a touching point
export const FRAME_MIN_LEN = 18.0;         // keep walking until the path is at least this long
export const FRAME_MAX_STEPS = 160;        // hard cap on arcs walked (safety)
export const FRAME_SAMPLES = 96;           // dense samples per full (2π) revolution
export const FRAME_TAN_EPS = 1e-4;         // tangency / coincident-point tolerance

// ---- 3D loop ---------------------------------------------------------------
export const R3D = 0.95;            // 3D orbit radius (x/y) — rings the rosette
export const Z3D = 0.45;            // 3D orbit out-of-plane amplitude
export const LOOP3_PIVOTS = 24;     // pivots around the orbit (more -> crisper petals)
export const LOOP3_WAVES = 3;       // z undulations per orbit (full periods)
export const LOOP3_LOBES = 3;       // radial petals
export const LOOP3_LOBE_DEPTH = 0.45; // how far each petal dips inward, as a fraction of R3D
export const SP2 = 2.0;             // 2D dragon speed (world units / sec)
export const SP3 = 1.5;             // 3D dragon speed
export const ENSO_DUR = (2 * Math.PI * ENSO_R) / SP2; // enso circumference / speed
export const CROSSFADE = 1.0;       // 2D->3D crossfade duration
export const CAM_PITCH_DUR = CROSSFADE * 4; // camera pitch tilt duration (slower than the fade)
export const MAX_EXIT_TURN = Math.PI / 4; // cap on the peel-off turn at the branch onto loop3
export const MIN_TURN = Math.PI / 9;      // floor on the turn angle at a pivot
export const MAX_TURN = Math.PI / 2;      // angle above which a pivot counts as a "sharp" turn
export const MAX_SHARP_RUN = 2;           // a sharp turn is fine, but not N in a row
export const RELAX_ITERS = 5;             // relaxation passes
export const D3_FADEIN_FRAC = 0.55;       // fraction of the crossfade spent fading the 3D dragon IN

// ---- camera ----------------------------------------------------------------
export const CAM_PITCH_ANGLE = -Math.PI * 0.35; // straight-down (0) -> 45deg elevation tilt
export const CAM = { fov: (45 * Math.PI) / 180, dist: 2.6 };

// ---- fades / grid ----------------------------------------------------------
export const GLYPH_FADE_TARGET = 0.25; // glyph ink eases to this opacity as the 3D dragon takes over
export const ENSO_FADE_TARGET = 0.25;  // enso circle eases to this opacity as the 3D dragon takes over
export const GRID_REVEAL_DUR = 5.5;
export const GRID_MAX_OPACITY = 0.75;
export const GRID_MINOR_DIV = 5;  // minor cells per major cell
export const GRID_MINOR_LAG = 1.5; // minor grid wipe-in trails the major reveal
export const GRID = { z: -0.01, ext: 12.0, step: 0.6 };

// ---- 2D ink dragon body ----------------------------------------------------
export const BODY_N = 20;
export const BODY_LEN = 0.8;
export const PROP_SPEED = 0.2; // chain relaxation per step (verlet lag)
export const ENABLE_PHYSICS = false; // false -> body rigidly matches the line of motion
export const MAX_BEND = (60 * Math.PI) / 180;
export const HEAD_SIZE = 0.1;

// ---- 3D mesh ---------------------------------------------------------------
export const D3 = { N: 512, bodyFactor: 1.2, depth: 10 };
export const D3_GIRTH = 0.006; // cross-section scale for the 3D mesh

// ---- ink splash ------------------------------------------------------------
export const SPLASH_SPREAD = 1.2; // max blob radius (world units)
export const SPLASH_AMOUNT = 0.1; // 0..1 amount of ink blobs
export const SPLASH_FADE_IN = 5.0; // seconds for the wash to fade in at the start

// ---- glyph -----------------------------------------------------------------
export const GLYPH_SCALE = 0.36;
export const GLYPH_RADIUS = 0.06 * GLYPH_SCALE;
