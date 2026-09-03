// 2D Separating Axis Theorem (SAT) for oriented boxes.
//
// This is a faithful 2D reduction of the box-box SAT test in the Odin
// physics engine (mjolnir/physics/manifold.odin → collide_boxes). In 3D the
// same routine enumerates 6 face axes + 9 edge-edge cross axes; constrained to
// the XY plane the only axes that matter are the 4 face normals, so this module
// keeps that loop and drops the (degenerate, out-of-plane) edge crosses.
//
// Conventions, mirroring the Odin source:
//   • a "box frame" is a center, a half-extent pair, and two unit face axes.
//   • projection extent along axis n is  hx·|ax·n| + hy·|ay·n|.
//   • a candidate axis is oriented from A toward B before overlap is measured.
//   • the axis with the smallest overlap is the contact normal; that overlap is
//     the penetration depth (the minimum translation to separate the boxes).

export const EPS = 1e-9;

export const vadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const vscale = (a, s) => [a[0] * s, a[1] * s];
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const vlen = (a) => Math.hypot(a[0], a[1]);
export const vneg = (a) => [-a[0], -a[1]];
export const vperp = (a) => [-a[1], a[0]];
export const vnorm = (a) => {
  const l = vlen(a);
  return l < EPS ? [0, 1] : [a[0] / l, a[1] / l];
};
export const vlerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

/**
 * Build a 2D box frame from a center, half extents, and a CCW rotation angle.
 * axes[0] is the local +x face normal, axes[1] the local +y face normal.
 */
export function boxFrame(center, half, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    center,
    half,
    angle,
    axes: [
      [c, s],
      [-s, c],
    ],
  };
}

/** The 4 corners of a box in CCW order (starting at the -x,-y corner). */
export function boxCorners(f) {
  const [ax, ay] = f.axes;
  const [hx, hy] = f.half;
  return [
    vadd(vadd(f.center, vscale(ax, -hx)), vscale(ay, -hy)),
    vadd(vadd(f.center, vscale(ax, hx)), vscale(ay, -hy)),
    vadd(vadd(f.center, vscale(ax, hx)), vscale(ay, hy)),
    vadd(vadd(f.center, vscale(ax, -hx)), vscale(ay, hy)),
  ];
}

/** The 4 edges of a box with outward unit normals (CCW polygon convention). */
export function boxEdges(f) {
  const c = boxCorners(f);
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    out.push({ a, b, normal: vnorm([b[1] - a[1], -(b[0] - a[0])]) });
  }
  return out;
}

/** Project a box onto a unit axis; returns the interval [min, max] and extent. */
export function projectBox(f, n) {
  const ext =
    f.half[0] * Math.abs(vdot(f.axes[0], n)) + f.half[1] * Math.abs(vdot(f.axes[1], n));
  const c = vdot(f.center, n);
  return { min: c - ext, max: c + ext, ext };
}

/**
 * Enumerate the candidate separating axes for two boxes.
 * In 2D these are the 4 face normals. Each entry remembers which box owns the
 * axis and which face it came from, so the contact routine can pick a
 * reference face exactly like the Odin source does.
 */
export function satAxes(fa, fb) {
  return [
    { n0: fa.axes[0], owner: 0, face: 0, label: "A.x" },
    { n0: fa.axes[1], owner: 0, face: 1, label: "A.y" },
    { n0: fb.axes[0], owner: 1, face: 0, label: "B.x" },
    { n0: fb.axes[1], owner: 1, face: 1, label: "B.y" },
  ];
}

/**
 * Full SAT test. Returns every candidate axis with its two projected intervals
 * and overlap, plus the minimum-overlap axis (the contact normal) and the
 * penetration depth when the boxes overlap.
 */
export function satTest(fa, fb) {
  const d = vsub(fb.center, fa.center);
  const results = satAxes(fa, fb).map(({ n0, owner, face, label }) => {
    // Orient the axis from A toward B (Odin: `if dist < 0 do axis = -axis`).
    const axis = vdot(d, n0) >= 0 ? n0 : vneg(n0);
    const pa = projectBox(fa, axis);
    const pb = projectBox(fb, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    return { axis, n0, owner, face, label, pa, pb, overlap };
  });

  let min = results[0];
  let minIndex = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i].overlap < min.overlap) {
      min = results[i];
      minIndex = i;
    }
  }

  const hit = results.every((r) => r.overlap >= 0);
  return {
    hit,
    results,
    min,
    minIndex,
    normal: hit ? min.axis : null,
    penetration: hit ? min.overlap : 0,
  };
}

/**
 * Minimum translation vector (MTV). Moving box B by +mtv (or box A by -mtv)
 * separates the two boxes along the contact normal.
 */
export function mtv(test) {
  return test.hit ? vscale(test.normal, test.penetration) : [0, 0];
}

/** Sutherland–Hodgman clip of a convex polygon against dot(n, x) <= d. */
function clipPoly(poly, n, d) {
  if (poly.length === 0) return poly;
  const out = [];
  let prev = poly[poly.length - 1];
  let prevDist = vdot(n, prev) - d;
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const curDist = vdot(n, cur) - d;
    if (prevDist <= 0) out.push(prev);
    if (prevDist < 0 !== curDist < 0) {
      const t = prevDist / (prevDist - curDist);
      out.push(vlerp(prev, cur, t));
    }
    prev = cur;
    prevDist = curDist;
  }
  return out;
}

/**
 * Contact region for the minimum-overlap axis. Pick the reference face (the
 * face whose outward normal is the contact normal) and the incident face (the
 * most anti-parallel face on the other box), then clip the incident box
 * against the reference box. The surviving polygon is the contact region —
 * the 2D analogue of the 3D face clipping in collide_boxes.
 */
export function contactPoints(fa, fb, min) {
  const ref = min.owner === 0 ? fa : fb;
  const inc = min.owner === 0 ? fb : fa;
  const refFaceNormal = min.owner === 0 ? min.axis : vneg(min.axis);

  // Reference face: outward normal closest to refFaceNormal.
  const refEdges = boxEdges(ref);
  let refEdge = refEdges[0];
  let best = -Infinity;
  for (const e of refEdges) {
    const d = vdot(e.normal, refFaceNormal);
    if (d > best) {
      best = d;
      refEdge = e;
    }
  }

  // Incident face: outward normal most anti-parallel to refFaceNormal.
  const incEdges = boxEdges(inc);
  let incEdge = incEdges[0];
  best = Infinity;
  for (const e of incEdges) {
    const d = vdot(e.normal, refFaceNormal);
    if (d < best) {
      best = d;
      incEdge = e;
    }
  }

  // Clip the incident box against the reference box's four half-planes.
  let poly = boxCorners(inc);
  for (const e of refEdges) {
    poly = clipPoly(poly, e.normal, vdot(e.normal, e.a));
    if (poly.length === 0) break;
  }

  return { refEdge, incEdge, points: poly };
}
