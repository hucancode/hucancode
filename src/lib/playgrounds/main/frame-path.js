import { TAU, clamp } from "$lib/math/scalar.js";
import { arcLengthCurve, hermiteG } from "$lib/math/curve.js";
import {
  ENSO_R, ENSO_HEAD_R, BODY_LEN, SP3, ENSO_DUR, ENSO_REVS,
  FRAME_SMALL_R, FRAME_MEDIUM_N, FRAME_MEDIUM_R, FRAME_INNER_AXIS,
  FRAME_BRANCH_P, FRAME_MIN_LEN, FRAME_MAX_STEPS, FRAME_SAMPLES, FRAME_TAN_EPS,
  CHAIN_R, CHAIN_TURN, CHAIN_DOWN_BIAS, CHAIN_LATERAL, CHAIN_DESCEND,
  CHAIN_CENTER_R, CHAIN_MIN_SWEEP, CHAIN_MAX,
} from "./config.js";

const DOWN_ANG = -Math.PI / 2; // straight-down heading
// shortest signed angle from cur to target (in -π..π)
const angDiff = (target, cur) => Math.atan2(Math.sin(target - cur), Math.cos(target - cur));

// Eased enso head progress (0..1 over trace). Decelerates so end head speed ==
// 3D loop speed SP3 -> exit into roam2 / handoff deterministic (no jump).
// Hermite g with g(0)=0, g(1)=1, g'(1)=k where k = end-slope making
// d(arc)/dt == SP3 at exit (slopes 2-k, k make the cubic term vanish).
const ENSO_CIRC = TAU * ENSO_R;
const ENSO_END_K = clamp((SP3 * ENSO_DUR) / (ENSO_REVS * ENSO_CIRC), 0.15, 1.85);
export const ensoHeadProgress = (tau) =>
  clamp(hermiteG(clamp(tau, 0, 1), 2 - ENSO_END_K, ENSO_END_K), 0, 1);

// enso start angle: top of circle; head sweeps counter-clockwise
const ensoA0 = Math.PI / 2;

// Head sweeps counter-clockwise circle of radius ENSO_R about center (default
// origin), starting at top; frac in revolutions (0..1.5 traces 1.5 laps).
// Defined for any frac (frac<0 trails before start) so body can lead in.
export function ensoPos(frac, center) {
  const cx = center ? center.x : 0, cy = center ? center.y : 0;
  const a = ensoA0 + frac * TAU;
  // head traces ENSO_HEAD_R (just outside brush) for clearance over stroke
  return { x: cx + ENSO_HEAD_R * Math.cos(a), y: cy + ENSO_HEAD_R * Math.sin(a) };
}

// Corridor roam: string of externally-tangent circles whose centres stay near
// centre line (x->0). march heading (direction to next circle's centre) aims
// mostly lateral with gentle downward drift + pull toward centre -> dragon weaves
// side-to-side around centre while sinking, never drifting off screen. winding
// alternates each circle (required for C1 join at external tangency = S-weave) ->
// per-circle sweep fixed by march geometry; short hop gets whole extra lap so
// traces fuller. downward drift gentle + uniform -> sinks at steady rate with arc
// length, matching camera's linear descent (stays vertically centred). Walks until
// descended dropTarget or walked lenTarget of arc.
// Returns { curve (with headStart), pool, points, end }.
function generateCircleChain(rng, entry, heading, dropTarget, lenTarget = 0) {
  const [rMin, rMax] = CHAIN_R;
  const rand = (a, b) => a + (b - a) * rng();
  const pts = [{ x: entry.x, y: entry.y, z: 0 }];
  const pool = [];

  let r = rand(rMin, rMax);
  const nx = -Math.sin(heading), ny = Math.cos(heading); // normal to heading
  const side = rng() < 0.5 ? 1 : -1;
  let cx = entry.x + side * r * nx, cy = entry.y + side * r * ny; // c0 (entry on its rim)
  pool.push({ x: cx, y: cy, z: 0, r });
  let aIn = Math.atan2(entry.y - cy, entry.x - cx);
  // entry winding: first circle's start tangent must agree with heading so join
  // from fly-in has no cusp; subsequent circles alternate
  let dir = Math.sin(heading - aIn) >= 0 ? 1 : -1;
  let march = heading;       // running march heading (direction to next centre)
  const startY = entry.y;
  let len = 0;

  for (let i = 0; i < CHAIN_MAX; i++) {
    // march target: mostly lateral (steered toward centre, x->0) with gentle
    // uniform downward drift
    const dropFrac = clamp((startY - cy) / dropTarget, 0, 1);
    const hx = clamp(-cx / CHAIN_CENTER_R, -1, 1) * CHAIN_LATERAL; // toward centre
    const target = (hx === 0) ? DOWN_ANG : Math.atan2(-CHAIN_DESCEND, hx);
    march += (rng() * 2 - 1) * CHAIN_TURN;
    march += angDiff(target, march) * CHAIN_DOWN_BIAS;

    const rn = rand(rMin, rMax);
    // sweep to exit with tangent-point aimed along march for the alternating
    // winding; short hop gets whole extra lap (exit direction unchanged mod 2π so
    // next circle still lies along march) -> fuller traces
    let sweep = ((dir * (march - aIn)) % TAU + TAU) % TAU;
    if (sweep < FRAME_TAN_EPS) sweep += TAU;
    if (sweep < CHAIN_MIN_SWEEP * TAU) sweep += TAU;
    if (i === 0 && sweep < 0.85 * TAU) sweep += TAU; // first loop returns near centre
    // pad with extra full laps so cumulative length tracks lenTarget*dropFrac: a
    // lap returns to same exit point/direction -> adds length + fuller trace with
    // no net drop or drift. distributed by descent progress -> path reaches
    // lenTarget as it reaches dropTarget (long enough head never crawls).
    const lapArc = r * TAU;
    let laps = Math.round((lenTarget * dropFrac - len - r * sweep) / lapArc);
    sweep += clamp(laps, 0, 2) * TAU;

    const aOut = aIn + dir * sweep;
    const n = Math.max(2, Math.round(FRAME_SAMPLES * sweep / TAU));
    for (let k = 1; k <= n; k++) {
      const a = aIn + dir * sweep * (k / n);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), z: 0 });
    }
    len += r * sweep;
    // next circle: externally tangent along exit direction (== march mod 2π)
    const ux = Math.cos(aOut), uy = Math.sin(aOut);
    const ncx = cx + (r + rn) * ux, ncy = cy + (r + rn) * uy;
    aIn = Math.atan2(cy - ncy, cx - ncx); // faces back at shared point
    cx = ncx; cy = ncy; r = rn; dir = -dir; // alternate winding -> C1 S-weave
    pool.push({ x: cx, y: cy, z: 0, r });
    if ((startY - cy >= dropTarget) || len >= lenTarget) break;
  }

  // prepend two body lead-in points behind entry (so chain has something to
  // trail) and arc-length-parameterise
  const hdx = Math.cos(heading), hdy = Math.sin(heading);
  const all = [
    { x: entry.x - hdx * BODY_LEN * 2, y: entry.y - hdy * BODY_LEN * 2, z: 0 },
    { x: entry.x - hdx * BODY_LEN, y: entry.y - hdy * BODY_LEN, z: 0 },
    ...pts,
  ];
  const curve = arcLengthCurve(all, false);
  const e = curve.pos(curve.total), et = curve.tan(curve.total);
  return {
    curve: { ...curve, headStart: curve.arcAt(2) },
    pool,
    points: all, // raw polyline (entry at index 2) for concatenating connector
    end: { x: e.x, y: e.y, dir: { x: et.x, y: et.y } },
  };
}

// Sample C1 cubic Bezier (controls along end headings) into point array.
function c1ArcPoints(p0, h0, p1, h1, tension = 0.4) {
  const chord = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1e-6;
  const d = tension * chord;
  const c1 = { x: p0.x + Math.cos(h0) * d, y: p0.y + Math.sin(h0) * d };
  const c2 = { x: p1.x - Math.cos(h1) * d, y: p1.y - Math.sin(h1) * d };
  const N = 40, out = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, v = 1 - u;
    const b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
    out.push({
      x: b0 * p0.x + b1 * c1.x + b2 * c2.x + b3 * p1.x,
      y: b0 * p0.y + b1 * c1.y + b2 * c2.y + b3 * p1.y,
      z: 0,
    });
  }
  return out;
}

// Full B2+B3 descent path as ONE curve: circle-chain weaving down from fly-in
// end, then C1 connector onto enso top. Single arc-length curve so dragon crosses
// at one continuous (cubic-eased) speed and arrives tangent to enso. lenTarget
// makes chain long enough head's cruise speed never crawls. headStart skips body
// lead-in.
export function buildDescent(rng, entry, heading, ensoTop, ensoTopHeading, drop, lenTarget = 0) {
  const chain = generateCircleChain(rng, entry, heading, drop, lenTarget);
  const ce = chain.end;
  const conn = c1ArcPoints(ce, Math.atan2(ce.dir.y, ce.dir.x), ensoTop, ensoTopHeading);
  const pts = [...chain.points, ...conn.slice(1)]; // entry stays at index 2
  const curve = arcLengthCurve(pts, false);
  return { curve: { ...curve, headStart: curve.arcAt(2) }, pool: chain.pool };
}

// Build rosette frame as list of {cx, cy, r} circles, then wire every tangency
// between them. tangency stored on BOTH circles as {a, j, aj}: angle on this
// circle, partner index, angle on partner at shared point. detected numerically:
// external when centre distance == ri+rj, internal when == |ri-rj|.
function buildFrame(center) {
  const ox = center ? center.x : 0, oy = center ? center.y : 0;
  // grand circle = head clearance radius (just outside painted brush) so every
  // frame circle tangent to it keeps gap from actual enso stroke
  const R = ENSO_HEAD_R;
  const circles = [{ cx: ox, cy: oy, r: R }]; // 0: enso (grand circle)

  // vesica pair: two equal circles tangent at centre, each internally tangent to
  // enso at ends of FRAME_INNER_AXIS diameter
  const ir = FRAME_SMALL_R * R;
  for (const s of [1, -1]) {
    circles.push({ cx: ox + s * ir * Math.cos(FRAME_INNER_AXIS), cy: oy + s * ir * Math.sin(FRAME_INNER_AXIS), r: ir });
  }

  // medium ring: FRAME_MEDIUM_N equal circles externally tangent to enso, evenly
  // spaced. non-overlap needs (R+r)·sin(π/n) >= r; clamp to that limit.
  const s = Math.sin(Math.PI / FRAME_MEDIUM_N);
  const rMaxNoOverlap = (R * s) / (1 - s);
  const rmed = Math.min(FRAME_MEDIUM_R * R, rMaxNoOverlap);
  const MD = R + rmed; // centre distance for external tangency to enso
  for (let k = 0; k < FRAME_MEDIUM_N; k++) {
    const a = k * (TAU / FRAME_MEDIUM_N);
    circles.push({ cx: ox + MD * Math.cos(a), cy: oy + MD * Math.sin(a), r: rmed });
  }

  // wire tangencies (numeric: handles internal, external, coincident points)
  for (const c of circles) c.tan = [];
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i], b = circles[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const d = Math.hypot(dx, dy) || 1e-9;
      const ext = Math.abs(d - (a.r + b.r)) < FRAME_TAN_EPS;
      const int = Math.abs(d - Math.abs(a.r - b.r)) < FRAME_TAN_EPS;
      if (!ext && !int) continue;
      let px, py;
      if (ext) {
        px = a.cx + (dx / d) * a.r; py = a.cy + (dy / d) * a.r;
      } else {
        const aBig = a.r >= b.r;
        const big = aBig ? a : b, sgn = aBig ? 1 : -1;
        px = big.cx + (sgn * dx / d) * big.r; py = big.cy + (sgn * dy / d) * big.r;
      }
      const ai = Math.atan2(py - a.cy, px - a.cx);
      const aj = Math.atan2(py - b.cy, px - b.cx);
      a.tan.push({ a: ai, j, aj });
      b.tan.push({ a: aj, j: i, aj: ai });
    }
  }
  return circles;
}

// Walk frame: start on enso (circle 0) at entry, riding arc whose tangent matches
// heading. At each tangency stay or branch onto touching circle (FRAME_BRANCH_P);
// either join C1-smooth. Walks until polyline at least FRAME_MIN_LEN long, ending
// ON a tangency point.
function walkFrame(rng, circles, entry, heading) {
  let ci = 0;
  let ang = Math.atan2(entry.y - circles[0].cy, entry.x - circles[0].cx);
  // tangent for dir=+1 is (-sin, cos); pick dir whose tangent agrees with heading
  let dir = (-Math.sin(ang) * Math.cos(heading) + Math.cos(ang) * Math.sin(heading)) >= 0 ? 1 : -1;

  const pts = [{ x: entry.x, y: entry.y, z: 0 }];
  let len = 0;
  let swept = 0; // angle swept on current circle since entering it
  for (let step = 0; step < FRAME_MAX_STEPS; step++) {
    const c = circles[ci];
    // next tangency on this circle in travel direction (smallest positive sweep)
    let best = null, bestSweep = Infinity;
    for (const tp of c.tan) {
      let sweep = ((dir * (tp.a - ang)) % TAU + TAU) % TAU;
      if (sweep < FRAME_TAN_EPS) sweep += TAU; // skip point we're sitting on
      if (sweep < bestSweep) { bestSweep = sweep; best = tp; }
    }
    if (!best) break; // isolated circle (never happens on wired frame)

    const n = Math.max(2, Math.round(FRAME_SAMPLES * bestSweep / TAU));
    for (let i = 1; i <= n; i++) {
      const t = ang + dir * bestSweep * (i / n);
      pts.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t), z: 0 });
    }
    len += c.r * bestSweep;
    swept += bestSweep;
    ang = best.a;

    if (len >= FRAME_MIN_LEN) break; // end on tangency -> clean 3D handoff

    // commit to at least half circle before peeling off (no quick in/out)
    if (swept >= Math.PI - FRAME_TAN_EPS && rng() < FRAME_BRANCH_P) {
      // branch onto partner; preserve tangent -> derive partner's dir
      const aj = best.aj;
      const tx = dir * -Math.sin(ang), ty = dir * Math.cos(ang); // arrival tangent
      const ndir = (tx * -Math.sin(aj) + ty * Math.cos(aj)) >= 0 ? 1 : -1;
      ci = best.j; ang = aj; dir = ndir; swept = 0;
    }
  }
  return pts;
}

// 3D orbit built the way the 2D paths are: from CIRCLES. A ring of n equal
// circles, each externally tangent to both neighbours, walked with alternating
// winding (the same C1 S-weave rule as the descent chain) -> a closed wavy
// loop of pure circular arcs that crosses the centre-ring radially at every
// tangency, bulging alternately outside/inside. Height: every tangency point
// gets z = zAmp*sin(waves*(k+1)/n*TAU) and each arc cosine-eases between its
// end heights (zero z-slope at the joins -> C1 in z). The walk STARTS on the
// zero-height tangency, so a connector meets the loop flat. `rot` places that
// start tangency at world angle rot - PI/n; `reverse` runs the same loop
// clockwise (start point unchanged). n must be EVEN so the winding
// alternation closes consistently.
export function generateOrbit3d(center, n, outerR, zAmp, waves, rot, reverse) {
  const ox = center.x, oy = center.y;
  const rc = outerR / (1 + Math.sin(Math.PI / n)); // centre-ring radius; weave peaks at outerR
  const r = rc * Math.sin(Math.PI / n);            // circle radius = neighbour tangency
  const C = [], P = [], Z = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU;
    C.push({ x: ox + rc * Math.cos(a), y: oy + rc * Math.sin(a) });
  }
  for (let k = 0; k < n; k++) {
    const b = C[(k + 1) % n]; // equal radii -> tangency is the centre midpoint
    P.push({ x: (C[k].x + b.x) / 2, y: (C[k].y + b.y) / 2 });
    Z.push(zAmp * Math.sin(((waves * (k + 1)) / n) * TAU)); // k = n-1 -> exactly 0
  }
  const pts = [];
  for (let k = 0; k < n; k++) {
    const c = C[k];
    const pin = P[(k + n - 1) % n], pout = P[k];
    const zin = Z[(k + n - 1) % n], zout = Z[k];
    const aIn = Math.atan2(pin.y - c.y, pin.x - c.x);
    const aOut = Math.atan2(pout.y - c.y, pout.x - c.x);
    const dir = k % 2 === 0 ? 1 : -1;              // alternate winding = C1 joins
    let sweep = (((dir * (aOut - aIn)) % TAU) + TAU) % TAU;
    if (sweep < FRAME_TAN_EPS) sweep += TAU;
    const m = Math.max(2, Math.round((FRAME_SAMPLES * sweep) / TAU));
    for (let i = k === 0 ? 0 : 1; i <= m; i++) {
      const a = aIn + dir * sweep * (i / m);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * (i / m)); // C1 height ease
      pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), z: zin + (zout - zin) * e });
    }
  }
  if (reverse) pts.reverse();
  return pts;
}

// 2D roam path: walk rosette frame from enso exit, prepend two body lead-in
// points behind entry (so verlet chain has something to trail), arc-length
// parameterise dense polyline (open path). Returns curve (with headStart) plus
// circle centres as debug pool.
export function generateFramePath(rng, entry, heading, center) {
  const circles = buildFrame(center);
  const pool = circles.map((c) => ({ x: c.cx, y: c.cy, z: 0, r: c.r })); // debug: circle centres
  const hdx = Math.cos(heading), hdy = Math.sin(heading);
  const walk = walkFrame(rng, circles, entry, heading); // walk[0] === entry
  const allPts = [
    { x: entry.x - hdx * BODY_LEN * 2, y: entry.y - hdy * BODY_LEN * 2, z: 0 },
    { x: entry.x - hdx * BODY_LEN,     y: entry.y - hdy * BODY_LEN,     z: 0 },
    ...walk,
  ];
  const headEntryIdx = 2; // allPts[2] === entry
  const curve = arcLengthCurve(allPts, false);
  return { curve: { ...curve, headStart: curve.arcAt(headEntryIdx) }, pool };
}

