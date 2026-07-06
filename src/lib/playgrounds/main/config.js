// Static tunables for /paint scene. Pure data; derived schedule times live in
// timing.js.

// camera look-at descends in world-Y; objects live at fixed Y "stations", dragon
// flies down with camera. schedule block-driven (durations below).
export const BLOCK_DUR = {
  flyin: 2,     // B1: dragon reveals top-middle, flies down to catch camera
  roam1: 5,     // B2: tangent-circle chain roam, arrives mid-screen
  approach: 5,  // B3: glyph traces in from below; dragon leads to enso border
  enso: 2,      // B4: enso traces, dragon leads, exits bottom after 1.5 revs
  roam2: 4,     // B5: resume circle roam; camera stops descending, starts pitch
  crossfade: 6, // B6: 2D dragon out, 3D dragon assembles in on same path
  loop3: 5,     // B7: 3D dragon loops (persistent past this)
};
export const CORRIDOR_DROP = 6.0;   // total world-Y look-at descends over B1-B3
export const CORRIDOR_TAIL = 8.0;   // seconds of 3D loop kept after handoff
export const FLYIN_TOP_Y = 0.8;     // dragon spawn height above start look-at
export const FLYIN_BOW = 0.18;      // lateral bow of fly-in line

// circle-chain roam: string of externally-tangent circles. march heading aims
// mostly lateral with gentle downward drift + pull toward centre line (x->0) ->
// dragon weaves side-to-side around centre while slowly sinking. winding
// alternates per circle (C1 S-weave). downward drift uniform -> sinks steadily
// with arc length, tracking linear camera.
export const CHAIN_R = [0.28, 0.5];      // [min,max] circle radius (world units)
export const CHAIN_TURN = 0.6;           // random heading wander per circle (rad)
export const CHAIN_DOWN_BIAS = 0.4;      // how fast march eases toward target heading
export const CHAIN_LATERAL = 0.9;        // horizontal weight of march target
export const CHAIN_DESCEND = 0.32;       // downward weight of march target (small -> mostly lateral)
export const CHAIN_CENTER_R = 0.40;      // |x| at which centring pull saturates
export const CHAIN_MIN_SWEEP = 0.35;     // skip in/out hops below this trace fraction (turns)
export const CHAIN_LEN_FRAC = 0.85;      // descent length target as fraction of CRUISE_SP*descentDur
                                         // (raises descentAvg -> descentStart, kills start crawl)
export const CHAIN_MAX = 60;             // cap on circles per roam (safety)

export const ENSO_R = 0.4;           // enso radius (world units; <1 keeps it on-screen)
export const ENSO_WIDTH = 0.15;       // enso brush thickness (polar line width in shader)
export const ENSO_CLEARANCE = 0.06;  // gap between brush outer edge and dragon head path
// dragon traces just outside brush so contour clears painted stroke
export const ENSO_HEAD_R = ENSO_R + ENSO_WIDTH * 0.5 + ENSO_CLEARANCE;
export const GROW_DUR = 2.5;         // body eases to full size over this span from roam1Start
export const ENTRY_GROW_MIN = 0.2;   // body length fraction at entry (fly-in), grows to 1 by enso
export const ENTRY_SIZE_MIN = 0.4;   // body width / head size fraction at entry, grows to 1

export const FRAME_SMALL_R = 0.5;          // vesica-lobe radius as fraction of ENSO_R
export const FRAME_MEDIUM_N = 8;           // medium circles externally tangent to enso
export const FRAME_MEDIUM_R = 0.7;         // medium radius as fraction of ENSO_R (clamped)
export const FRAME_INNER_AXIS = Math.PI / 8; // vesica-pair axis (offset off medium spokes)
export const FRAME_BRANCH_P = 0.5;         // chance to switch circles at touching point
export const FRAME_MIN_LEN = 18.0;         // keep walking until path at least this long
export const FRAME_MAX_STEPS = 160;        // cap on arcs walked (safety)
export const FRAME_SAMPLES = 96;           // dense samples per full (2π) revolution
export const FRAME_TAN_EPS = 1e-4;         // tangency / coincident-point tolerance

// 3D orbit: built from CIRCLES like the 2D paths — a ring of equal
// externally-tangent circles walked with alternating winding (C1 S-weave,
// the descent-chain rule) -> closed loop of pure circular arcs with
// meaningful turns; per-tangency heights (cosine-eased along each arc) give
// the height variation.
export const R3D = 1.25;            // outer reach of the weave (x/y); rings the rosette
export const Z3D = 0.4;             // 3D orbit out-of-plane amplitude
export const LOOP3_CIRCLES = 12;    // tangent circles in the orbit ring (EVEN)
export const LOOP3_WAVES = 2;       // z undulations per orbit (full periods)
export const SP3 = 1.2;             // 3D dragon speed
export const ENSO_REVS = 1.5;       // enso trace covers 1.5 revolutions (exit at bottom-most point)
export const ENSO_DUR = BLOCK_DUR.enso; // enso trace spans B4 block
// 2D cruise speed: enso head enters at this, decelerates to SP3 over 1.5-rev
// trace (linear-decel: ensoLen = (CRUISE_SP+SP3)/2 * ENSO_DUR). descent ramps up
// to CRUISE_SP so descent->enso join has no speed bump.
export const CRUISE_SP = (2 * ENSO_REVS * 2 * Math.PI * ENSO_R) / ENSO_DUR - SP3;
export const CROSSFADE = BLOCK_DUR.crossfade; // 2D->3D crossfade duration (== B6)
export const CAM_PITCH_DUR = 4.0;   // camera pitch tilt duration (settles after crossfade)
export const D3_FADEIN_FRAC = 0.55;       // fraction of crossfade spent fading 3D dragon in

export const CAM_PITCH_ANGLE = -Math.PI * 0.35; // straight-down (0) -> 45deg elevation tilt
export const CAM = { fov: (45 * Math.PI) / 180, dist: 2.6 };

export const GLYPH_FADE_TARGET = 0.75; // glyph ink eases to this opacity as 3D dragon takes over
export const ENSO_FADE_TARGET = 0.85;  // enso circle eases to this opacity as 3D dragon takes over
export const GRID_REVEAL_DUR = 8.0;  // grid wipes in slowly (spans past fly-in, into roam)
export const GRID_MAX_OPACITY = 0.85;
export const GRID_MINOR_DIV = 5;  // minor cells per major cell
export const GRID_MINOR_LAG = 1.5; // seconds minor grid wipe-in trails major reveal
export const GRID = { z: -0.01, ext: 12.0, step: 0.6 };

// ink layer extent: the 2D dragon offscreen texture + its composite quad span
// this multiple of the flat screen (world units: y +-INK_EXT, x +-aspect*INK_EXT).
// 1.0 = exactly one screen -> body poking past the top edge (roam2 flower
// reach ~1.13 from station) gets cut at the texture border, visible once the
// camera pitch reveals ground beyond the quad. 1.35 > reach + margin.
export const INK_EXT = 1.35;

export const BODY_N = 20;
export const BODY_LEN = 0.8;
export const HEAD_SIZE = 0.1;

export const D3 = { N: 512, bodyFactor: 1.2 };
export const D3_GIRTH = 0.006; // cross-section scale for 3D mesh
// which 3D dragon rides the loop: "mech" = procedural mech rig (instanced part
// kit from the /mech playground), "obj" = legacy skinned dragon-low.obj mesh
export const D3_STYLE = "mech";
export const D3_MECH_SCALE = 1.0; // mech dragon size vs the obj ribbon's bodyArc

export const GLYPH_SCALE = 0.36;
export const GLYPH_RADIUS = 0.06 * GLYPH_SCALE;
