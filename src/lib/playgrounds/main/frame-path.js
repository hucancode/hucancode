// The 2D roam geometry: the enso circle, the straight lead-in, the rosette of
// tangent circles the ink dragon walks, and the smooth C-branch from the glyph
// end onto the enso. All pure builders — fed the entry/heading and the session
// PRNG, they return paths the head-path module samples.

import { TAU, clamp } from "$lib/math/scalar.js";
import { arcLengthCurve } from "$lib/math/curve.js";
import {
  ENSO_R, ENSO_HEAD_R, BODY_LEN, SP3, ENSO_DUR, ENSO_REVS,
  FRAME_SMALL_R, FRAME_MEDIUM_N, FRAME_MEDIUM_R, FRAME_INNER_AXIS,
  FRAME_BRANCH_P, FRAME_MIN_LEN, FRAME_MAX_STEPS, FRAME_SAMPLES, FRAME_TAN_EPS,
  CHAIN_R, CHAIN_TURN, CHAIN_DOWN_BIAS, CHAIN_LATERAL, CHAIN_DESCEND,
  CHAIN_CENTER_R, CHAIN_MIN_SWEEP, CHAIN_MAX,
} from "./config.js";

const DOWN_ANG = -Math.PI / 2; // straight-down heading
// shortest signed angle from `cur` to `target` (in -π..π)
const angDiff = (target, cur) => Math.atan2(Math.sin(target - cur), Math.cos(target - cur));

// Eased enso head progress (0..1 over the trace). It DECELERATES so the head speed
// at the end equals the 3D loop speed SP3 — so when the dragon exits the enso into
// the second roam and hands off to the 3D dragon, the speed is deterministic (no
// jump). Quadratic g with g(0)=0, g(1)=1, g'(1)=k where k is the end-slope that
// makes d(arc)/dt == SP3 at the exit.
const ENSO_CIRC = TAU * ENSO_R;
const ENSO_END_K = clamp((SP3 * ENSO_DUR) / (ENSO_REVS * ENSO_CIRC), 0.15, 1.85);
export function ensoHeadProgress(tau) {
  tau = clamp(tau, 0, 1);
  const a = ENSO_END_K - 1, b = 2 - ENSO_END_K; // a+b=1, 2a+b=k
  return clamp(a * tau * tau + b * tau, 0, 1);
}

// enso start angle: top of circle (fixed); head sweeps counter-clockwise.
export const ensoA0 = Math.PI / 2;

// The head sweeps a counter-clockwise circle of radius ENSO_R about `center`
// (default origin), starting at the top; `frac` is in revolutions (0..1.5 traces
// 1.5 laps). Defined for any frac (frac<0 trails before the start) so the body can
// lead in.
export function ensoPos(frac, center) {
  const cx = center ? center.x : 0, cy = center ? center.y : 0;
  const a = ensoA0 + frac * TAU; // counter-clockwise (increasing angle)
  // head traces ENSO_HEAD_R (just outside the brush) for clearance over the stroke
  return { x: cx + ENSO_HEAD_R * Math.cos(a), y: cy + ENSO_HEAD_R * Math.sin(a) };
}

// Corridor roam: a STRING of externally-tangent circles whose CENTRES stay near
// the centre line (x->0). The march heading (the direction to the next circle's
// centre) aims MOSTLY LATERAL with a gentle downward drift PLUS a pull back toward
// centre, so each new centre is generated near the camera centre — the dragon
// weaves side-to-side around centre while slowly sinking, never drifting off
// screen. The winding ALTERNATES each circle (required for a C1 join at external
// tangency — an S-weave), so the per-circle sweep is fixed by the march geometry; a
// short hop gets a whole extra lap so traces stay fuller. Because the march weaves
// laterally, the sweep angles naturally spread across ~1/2 .. full turns (the soft
// "half / three-quarter / full" mix). The downward drift is GENTLE and uniform, so
// the dragon sinks at a steady rate with arc length — matching the camera's linear
// descent so it stays vertically centred (no sinking off the bottom). Walks until it
// has either descended `dropTarget` or walked `lenTarget` of arc (the mostly-lateral
// weave makes the path long, so the head cruises it at a healthy near-constant speed
// — no start crawl). Returns { curve (with headStart), pool, points, end }.
export function generateCircleChain(rng, entry, heading, dropTarget, lenTarget = 0) {
  const [rMin, rMax] = CHAIN_R;
  const rand = (a, b) => a + (b - a) * rng();
  const pts = [{ x: entry.x, y: entry.y, z: 0 }];
  const pool = [];

  let r = rand(rMin, rMax);
  const nx = -Math.sin(heading), ny = Math.cos(heading); // normal to heading
  const side = rng() < 0.5 ? 1 : -1;
  let cx = entry.x + side * r * nx, cy = entry.y + side * r * ny; // c0 (entry on its rim)
  pool.push({ x: cx, y: cy, z: 0 });
  let aIn = Math.atan2(entry.y - cy, entry.x - cx);
  // entry winding: the first circle's start tangent must agree with `heading` so the
  // join from the fly-in has no cusp; subsequent circles alternate.
  let dir = Math.sin(heading - aIn) >= 0 ? 1 : -1;
  let march = heading;       // running march heading (direction to the next centre)
  const startY = entry.y;
  let len = 0;

  for (let i = 0; i < CHAIN_MAX; i++) {
    // march TARGET: a vector that is mostly lateral (steered toward centre, x->0)
    // with a gentle, uniform downward drift — so the chain weaves side-to-side about
    // centre while sinking steadily with arc length (tracks the linear camera).
    const dropFrac = clamp((startY - cy) / dropTarget, 0, 1); // how far we have sunk
    const hx = clamp(-cx / CHAIN_CENTER_R, -1, 1) * CHAIN_LATERAL; // toward centre
    const target = (hx === 0) ? DOWN_ANG : Math.atan2(-CHAIN_DESCEND, hx);
    march += (rng() * 2 - 1) * CHAIN_TURN;          // random wander
    march += angDiff(target, march) * CHAIN_DOWN_BIAS; // ease toward the target heading

    const rn = rand(rMin, rMax);
    // sweep to exit with the tangent-point aimed along `march` for the (alternating)
    // winding; a short hop gets a whole extra lap (exit direction unchanged mod 2π,
    // so the next circle still lies along march) -> fuller traces.
    let sweep = ((dir * (march - aIn)) % TAU + TAU) % TAU;
    if (sweep < FRAME_TAN_EPS) sweep += TAU;
    if (sweep < CHAIN_MIN_SWEEP * TAU) sweep += TAU;
    if (i === 0 && sweep < 0.85 * TAU) sweep += TAU; // first loop returns near centre
    // PAD with extra full laps so the cumulative length tracks lenTarget*dropFrac:
    // a lap returns to the same exit point/direction, so it adds length + a fuller
    // trace WITHOUT any net drop or drift. Distributed by descent progress, this
    // makes the path reach lenTarget exactly as it reaches dropTarget (uniform speed
    // + a half/full trace mix) — and long enough that the head never crawls.
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
    // next circle: externally tangent along the exit direction (== march mod 2π)
    const ux = Math.cos(aOut), uy = Math.sin(aOut);
    const ncx = cx + (r + rn) * ux, ncy = cy + (r + rn) * uy;
    aIn = Math.atan2(cy - ncy, cx - ncx); // faces back at the shared point
    cx = ncx; cy = ncy; r = rn; dir = -dir; // alternate winding -> C1 S-weave
    pool.push({ x: cx, y: cy, z: 0 });
    // stop once it has sunk far enough OR walked the length target — whichever first
    // (the gentle descent keeps these close; the connector absorbs any small gap to
    // the enso top, so the chain never plunges below it).
    if ((startY - cy >= dropTarget) || len >= lenTarget) break;
  }

  // prepend two body lead-in points behind the entry (so the chain has something
  // to trail) and arc-length-parameterise.
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
    points: all, // raw polyline (entry at index 2) for concatenating a connector
    end: { x: e.x, y: e.y, dir: { x: et.x, y: et.y } },
  };
}

// Sample a C1 cubic Bezier (controls along the end headings) into a point array.
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

// The full B2+B3 DESCENT path as ONE curve: a circle-chain weaving down from the
// fly-in end, then a C1 connector onto the enso top. Built as a single arc-length
// curve so the dragon crosses it at one continuous (cubic-eased) speed — no crawl,
// no kink — and arrives tangent to the enso. `lenTarget` makes the chain long
// enough that the head's cruise speed never crawls. headStart skips the body lead-in.
export function buildDescent(rng, entry, heading, ensoTop, ensoTopHeading, drop, lenTarget = 0) {
  const chain = generateCircleChain(rng, entry, heading, drop, lenTarget);
  const ce = chain.end;
  const conn = c1ArcPoints(ce, Math.atan2(ce.dir.y, ce.dir.x), ensoTop, ensoTopHeading);
  const pts = [...chain.points, ...conn.slice(1)]; // entry stays at index 2
  const curve = arcLengthCurve(pts, false);
  return { curve: { ...curve, headStart: curve.arcAt(2) }, pool: chain.pool };
}

// Build the rosette frame as a list of {cx, cy, r} circles, then wire up every
// tangency between them. A tangency is stored on BOTH circles as {a, j, aj}:
// the angle on this circle, the partner index, and the angle on the partner at
// the shared point. Tangencies are detected numerically — external when the
// centre distance equals ri+rj, internal when it equals |ri-rj|.
function buildFrame(center) {
  const ox = center ? center.x : 0, oy = center ? center.y : 0;
  // grand circle = the head clearance radius (just outside the painted brush), so
  // every frame circle tangent to it keeps a gap from the actual enso stroke.
  const R = ENSO_HEAD_R;
  const circles = [{ cx: ox, cy: oy, r: R }]; // 0: the enso (grand circle)

  // vesica pair: two equal circles tangent at the centre, each internally tangent
  // to the enso at the ends of the FRAME_INNER_AXIS diameter.
  const ir = FRAME_SMALL_R * R;
  for (const s of [1, -1]) {
    circles.push({ cx: ox + s * ir * Math.cos(FRAME_INNER_AXIS), cy: oy + s * ir * Math.sin(FRAME_INNER_AXIS), r: ir });
  }

  // medium ring: FRAME_MEDIUM_N equal circles externally tangent to the enso,
  // evenly spaced. Non-overlap needs (R+r)·sin(π/n) >= r; clamp to that limit.
  const s = Math.sin(Math.PI / FRAME_MEDIUM_N);
  const rMaxNoOverlap = (R * s) / (1 - s);
  const rmed = Math.min(FRAME_MEDIUM_R * R, rMaxNoOverlap);
  const MD = R + rmed; // centre distance for external tangency to the enso
  for (let k = 0; k < FRAME_MEDIUM_N; k++) {
    const a = k * (TAU / FRAME_MEDIUM_N);
    circles.push({ cx: ox + MD * Math.cos(a), cy: oy + MD * Math.sin(a), r: rmed });
  }

  // wire tangencies (numeric: handles internal, external and coincident points)
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

// Walk the frame: start on the enso (circle 0) at `entry`, riding the arc whose
// tangent matches `heading`. At each tangency either stay or branch onto a
// touching circle (FRAME_BRANCH_P); either join is C1-smooth. Walks until the
// polyline is at least FRAME_MIN_LEN long, ending ON a tangency point.
function walkFrame(rng, circles, entry, heading) {
  let ci = 0;
  let ang = Math.atan2(entry.y - circles[0].cy, entry.x - circles[0].cx);
  // tangent for dir=+1 is (-sin, cos); pick the dir whose tangent agrees with heading
  let dir = (-Math.sin(ang) * Math.cos(heading) + Math.cos(ang) * Math.sin(heading)) >= 0 ? 1 : -1;

  const pts = [{ x: entry.x, y: entry.y, z: 0 }];
  let len = 0;
  let swept = 0; // angle swept on the CURRENT circle since entering it
  for (let step = 0; step < FRAME_MAX_STEPS; step++) {
    const c = circles[ci];
    // next tangency on this circle in travel direction (smallest positive sweep)
    let best = null, bestSweep = Infinity;
    for (const tp of c.tan) {
      let sweep = ((dir * (tp.a - ang)) % TAU + TAU) % TAU;
      if (sweep < FRAME_TAN_EPS) sweep += TAU; // skip the point we're sitting on
      if (sweep < bestSweep) { bestSweep = sweep; best = tp; }
    }
    if (!best) break; // isolated circle (never happens on a wired frame)

    // sample the arc from `ang` sweeping `bestSweep` in `dir`
    const n = Math.max(2, Math.round(FRAME_SAMPLES * bestSweep / TAU));
    for (let i = 1; i <= n; i++) {
      const t = ang + dir * bestSweep * (i / n);
      pts.push({ x: c.cx + c.r * Math.cos(t), y: c.cy + c.r * Math.sin(t), z: 0 });
    }
    len += c.r * bestSweep;
    swept += bestSweep;
    ang = best.a; // now sitting on the tangency point

    if (len >= FRAME_MIN_LEN) break; // end on a tangency -> clean 3D handoff

    // commit to at least half the circle before peeling off (no quick in/out)
    if (swept >= Math.PI - FRAME_TAN_EPS && rng() < FRAME_BRANCH_P) {
      // branch onto the partner; preserve the tangent -> derive the partner's dir
      const aj = best.aj;
      const tx = dir * -Math.sin(ang), ty = dir * Math.cos(ang); // arrival tangent
      const ndir = (tx * -Math.sin(aj) + ty * Math.cos(aj)) >= 0 ? 1 : -1;
      ci = best.j; ang = aj; dir = ndir; swept = 0;
    }
    // else: stay on the same circle, keep going past this tangency
  }
  return pts;
}

// 2D roam path: walk the rosette frame from the enso exit, prepend two body
// lead-in points behind the entry (so the verlet chain has something to trail),
// and arc-length parameterise the dense polyline (open path). Returns the curve
// (with headStart) plus the circle centres as a debug `pool`.
export function generateFramePath(rng, entry, heading, center) {
  const circles = buildFrame(center);
  const pool = circles.map((c) => ({ x: c.cx, y: c.cy, z: 0 })); // debug: circle centres
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

