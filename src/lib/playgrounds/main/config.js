// Static tunables for the /paint scene. Pure data — no derived schedule times
// (those live in timing.js, since the branch time depends on the generated path
// length). Grouped by subsystem; every consumer imports the names it needs.

// ---- corridor (scroll-down camera) -----------------------------------------
// The camera look-at descends in world-Y; objects live at fixed Y "stations" and
// the dragon flies down with the camera. The schedule is block-driven (durations
// below), no longer derived from a generated path length.
export const BLOCK_DUR = {
  flyin: 2,     // B1: dragon reveals top-middle, flies down to catch the camera
  roam1: 5,     // B2: tangent-circle chain roam, arrives mid-screen
  approach: 5,  // B3: glyph traces in from below; dragon leads to the enso border
  enso: 2,      // B4: enso traces, dragon leads, exits the bottom after 1.5 revs
  roam2: 4,     // B5: resume circle roam (longer); camera stops descending, starts pitch
  crossfade: 2, // B6: 2D dragon out, 3D dragon in on the same path
  loop3: 5,     // B7: 3D dragon loops (persistent past this)
};
export const CORRIDOR_DROP = 6.0;   // total world-Y the look-at descends over B1-B3
export const CORRIDOR_TAIL = 8.0;   // seconds of 3D loop kept after the handoff
export const FLYIN_TOP_Y = 0.8;     // dragon spawn height above the start look-at (top-middle)
export const FLYIN_BOW = 0.18;      // lateral bow of the slightly-curved fly-in line

// circle-chain roam: a string of externally-tangent circles. The march heading
// aims MOSTLY LATERAL with a gentle downward drift and a pull back toward the
// centre line (x->0), so the dragon weaves SIDE-TO-SIDE AROUND centre while slowly
// sinking — it never drifts off screen and the path is long (so the head can cruise
// it at a healthy, near-constant speed: no start crawl). Each circle is swept by a
// target fraction (rotating ~1/2 : 3/4 : full for an even mix); the winding + lap
// winding ALTERNATES (C1 S-weave), so the per-circle sweep is fixed by the march
// geometry and a short hop gets an extra lap; the lateral weave makes the sweep
// angles naturally spread across ~1/2..full turns (the soft trace-fraction mix).
// The downward drift is gentle + uniform so the dragon sinks steadily with arc
// length (tracking the linear camera -> stays vertically centred).
export const CHAIN_R = [0.28, 0.5];      // [min,max] circle radius (world units)
export const CHAIN_TURN = 0.6;           // random heading wander per circle (rad)
export const CHAIN_DOWN_BIAS = 0.4;      // how fast the march eases toward its target heading
export const CHAIN_LATERAL = 0.9;        // horizontal weight of the march target (sideways)
export const CHAIN_DESCEND = 0.32;       // downward weight of the march target (small -> mostly lateral)
export const CHAIN_CENTER_R = 0.40;      // |x| at which the centring pull saturates
export const CHAIN_MIN_SWEEP = 0.35;     // skip tiny in/out hops below this trace fraction (turns)
export const CHAIN_LEN_FRAC = 0.85;      // descent length target as a fraction of CRUISE_SP*descentDur
                                         // (raises descentAvg -> descentStart, killing the start crawl)
export const CHAIN_MAX = 60;             // hard cap on circles per roam (safety)

// ---- flight path -----------------------------------------------------------
// 2D dragon glyph-trace exit: peels off the glyph onto the enso at the END of
// this baked-segment index (0-based). null / out-of-range -> the final segment.
export const GLYPH_EXIT_SEG = 45;
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
export const SP3 = 1.5;             // 3D dragon speed
export const ENSO_REVS = 1.5;       // enso trace covers 1.5 revolutions (exit at bottom-most point)
export const ENSO_DUR = BLOCK_DUR.enso; // enso trace spans the B4 block
// 2D cruise speed: the enso head ENTERS at this speed and decelerates to SP3 over
// the 1.5-rev trace (linear-decel: ensoLen = (CRUISE_SP+SP3)/2 * ENSO_DUR). The
// descent ramps up to CRUISE_SP so the descent->enso join has no speed bump.
export const CRUISE_SP = (2 * ENSO_REVS * 2 * Math.PI * ENSO_R) / ENSO_DUR - SP3;
export const CROSSFADE = BLOCK_DUR.crossfade; // 2D->3D crossfade duration (== B6)
export const CAM_PITCH_DUR = 4.0;   // camera pitch tilt duration (settles after the crossfade)
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
export const GLYPH_FADE_TARGET = 0.45; // glyph ink eases to this opacity as the 3D dragon takes over
export const ENSO_FADE_TARGET = 0.35;  // enso circle eases to this opacity as the 3D dragon takes over
export const GRID_REVEAL_DUR = 8.0;  // grid wipes in slowly (spans past the fly-in, into the roam)
export const GRID_MAX_OPACITY = 0.75;
export const GRID_MINOR_DIV = 5;  // minor cells per major cell
export const GRID_MINOR_LAG = 1.5; // seconds the minor grid wipe-in trails the major reveal
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
export const SPLASH_AMOUNT = 0.05; // 0..1 amount of ink blobs
export const SPLASH_FADE_IN = 5.0; // seconds for the wash to fade in at the start

// ---- glyph -----------------------------------------------------------------
export const GLYPH_SCALE = 0.36;
export const GLYPH_RADIUS = 0.06 * GLYPH_SCALE;
