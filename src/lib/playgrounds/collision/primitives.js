// 2D ports of the primitive collision tests from the Odin physics engine
// (mjolnir/physics/collision.odin, manifold.odin, geometry/bounding_box.odin).
//
// The engine works in 3D; constrained to the XY plane every test reduces to a
// circle/capsule/box query. The reductions below keep the exact same structure
// as the 3D source (same region classification, same normal/penetration
// conventions) so the demos show what the engine actually computes.
//
// Conventions:
//   • shapes are { center: [x,y], radius } circles, box frames (see sat.js),
//     or capsules { a, b, radius } (a cylinder seen from the side).
//   • every test returns `normal` pointing from the FIRST shape to the SECOND,
//     `penetration` (positive when overlapping), and a representative contact
//     `point`, plus whatever debug geometry the demo wants to draw.

import {
  EPS,
  vadd,
  vsub,
  vscale,
  vdot,
  vlen,
  clamp,
  boxCorners,
} from "./sat.js";

/** Closest point on segment [a, b] to p, and the parameter t in [0, 1]. */
export function closestPointOnSegment(p, a, b) {
  const ab = vsub(b, a);
  const len2 = vdot(ab, ab);
  let t = 0;
  if (len2 > 1e-12) {
    t = clamp(vdot(vsub(p, a), ab) / len2, 0, 1);
  }
  return { point: vadd(a, vscale(ab, t)), t };
}

/**
 * Sphere vs sphere — the simplest test, and the same one used to reject pairs
 * that are far apart (`bounding_spheres_intersect` just drops the contact
 * data). Faithful port of test_sphere_sphere.
 */
export function circleCircle(a, b) {
  const delta = vsub(b.center, a.center);
  const dist = vlen(delta);
  const radiusSum = a.radius + b.radius;
  if (dist > radiusSum) {
    return { hit: false, dist, radiusSum, penetration: 0, normal: null, point: null };
  }
  const normal = dist > EPS ? vscale(delta, 1 / dist) : [0, 1];
  const penetration = radiusSum - dist;
  const point = vadd(a.center, vscale(normal, a.radius - penetration * 0.5));
  return { hit: true, dist, radiusSum, penetration, normal, point };
}

/**
 * Closest point on an oriented box to p — the heart of the box-sphere test.
 * Port of geometry.obb_closest_point (transform to local space, clamp to the
 * half extents, transform back).
 */
export function closestPointOnBox(box, p) {
  const d = vsub(p, box.center);
  const lx = clamp(vdot(d, box.axes[0]), -box.half[0], box.half[0]);
  const ly = clamp(vdot(d, box.axes[1]), -box.half[1], box.half[1]);
  return vadd(vadd(box.center, vscale(box.axes[0], lx)), vscale(box.axes[1], ly));
}

/**
 * Sphere vs box. Port of test_box_sphere: closest point on the box to the
 * sphere center, then a radius check. `normal` points from the circle toward
 * the box (A = circle, B = box in the demo).
 */
export function circleBox(circle, box) {
  const closest = closestPointOnBox(box, circle.center);
  const delta = vsub(circle.center, closest);
  const dist = vlen(delta);
  if (dist > circle.radius) {
    return { hit: false, closest, dist, penetration: 0, normal: null, point: null };
  }
  const normal = dist > EPS ? vscale(delta, -1 / dist) : [0, 1];
  const penetration = circle.radius - dist;
  const point = closest; // the Odin box-sphere manifold point is the closest point
  return { hit: true, closest, dist, penetration, normal, point };
}

/**
 * Sphere vs cylinder (side view → circle vs capsule). Port of
 * test_sphere_cylinder: find the closest point on the cylinder axis, classify
 * the region (cap vs side), then compare against the radius sum.
 *
 * `normal` points from the circle toward the capsule; `axis` is the closest
 * point on the axis segment and `surface` is the closest point on the capsule
 * surface.
 */
export function circleCapsule(circle, cap) {
  const axis = closestPointOnSegment(circle.center, cap.a, cap.b);
  const delta = vsub(circle.center, axis.point);
  const dist = vlen(delta);
  const region = axis.t > 1e-3 && axis.t < 1 - 1e-3 ? "side" : "cap";
  const radiusSum = circle.radius + cap.radius;
  if (dist > radiusSum) {
    return {
      hit: false,
      axis: axis.point,
      t: axis.t,
      region,
      dist,
      radiusSum,
      penetration: 0,
      normal: null,
      point: null,
      surface: null,
    };
  }
  const normal = dist > EPS ? vscale(delta, -1 / dist) : [0, 1];
  const surface = vadd(axis.point, vscale(normal, cap.radius));
  const penetration = radiusSum - dist;
  const point = vadd(surface, vscale(normal, penetration * 0.5));
  return {
    hit: true,
    axis: axis.point,
    t: axis.t,
    region,
    dist,
    radiusSum,
    penetration,
    normal,
    point,
    surface,
  };
}

/**
 * Closest points between two segments — the core of the non-parallel
 * cylinder-cylinder test (the two cylinder axes treated as capsule cores).
 * Faithful 2D port of the segment-segment routine in test_cylinder_cylinder.
 */
export function closestPointSegmentSegment(p0, p1, q0, q1) {
  const d1 = vsub(p1, p0);
  const d2 = vsub(q1, q0);
  const r = vsub(p0, q0);

  const a = vdot(d1, d1);
  const e = vdot(d2, d2);
  const f = vdot(d2, r);

  let s = 0;
  let t = 0;

  if (a <= EPS && e <= EPS) {
    s = 0;
    t = 0;
  } else if (a <= EPS) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = vdot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = vdot(d1, d2);
      const denom = a * e - b * b;
      if (denom !== 0) {
        s = clamp((b * f - c * e) / denom, 0, 1);
      } else {
        s = 0;
      }
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  return {
    p: vadd(p0, vscale(d1, s)),
    q: vadd(q0, vscale(d2, t)),
    s,
    t,
  };
}

/**
 * Cylinder vs cylinder (side view → capsule vs capsule). Port of
 * test_cylinder_cylinder. Parallel axes collapse to a circle-circle test in
 * the plane perpendicular to the axis; non-parallel axes are two capsule cores
 * compared via closest points between segments.
 *
 * `normal` points from A toward B; `cpA`/`cpB` are the closest points on the
 * two axis cores (the debug geometry the demo draws).
 */
export function capsuleCapsule(A, B) {
  const dirA = vsub(A.b, A.a);
  const dirB = vsub(B.b, B.a);
  const lenA = vlen(dirA);
  const lenB = vlen(dirB);
  const radiusSum = A.radius + B.radius;

  const centerA = vscale(vadd(A.a, A.b), 0.5);
  const centerB = vscale(vadd(B.a, B.b), 0.5);

  // Degenerate capsule → treat as a circle.
  if (lenA < EPS || lenB < EPS) {
    const delta = vsub(centerB, centerA);
    const dist = vlen(delta);
    if (dist > radiusSum) {
      return { hit: false, parallel: true, cpA: centerA, cpB: centerB, dist, radiusSum, normal: null, penetration: 0, point: null };
    }
    const normal = dist > EPS ? vscale(delta, 1 / dist) : [0, 1];
    const penetration = radiusSum - dist;
    const point = vadd(centerA, vscale(normal, A.radius - penetration * 0.5));
    return { hit: true, parallel: true, cpA: centerA, cpB: centerB, dist, radiusSum, normal, penetration, point };
  }

  const uA = vscale(dirA, 1 / lenA);
  const uB = vscale(dirB, 1 / lenB);
  const parallel = Math.abs(vdot(uA, uB)) > 0.99;

  if (parallel) {
    const n = [-uA[1], uA[0]];
    const signedRadial = vdot(vsub(B.a, A.a), n);
    const radialDist = Math.abs(signedRadial);

    // Axial overlap along the shared axis direction.
    const a0 = vdot(A.a, uA);
    const a1 = vdot(A.b, uA);
    const b0 = vdot(B.a, uA);
    const b1 = vdot(B.b, uA);
    const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1));
    const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1));
    if (hi < lo) {
      return { hit: false, parallel: true, cpA: null, cpB: null, dist: radialDist, radiusSum, normal: null, penetration: 0, point: null };
    }

    const mid = (lo + hi) / 2;
    const cpA = vadd(A.a, vscale(uA, mid - a0));
    const normal = signedRadial >= 0 ? n : [-n[0], -n[1]];
    const cpB = vadd(cpA, vscale(normal, radialDist));
    if (radialDist > radiusSum) {
      return { hit: false, parallel: true, cpA, cpB, dist: radialDist, radiusSum, normal, penetration: 0, point: null };
    }

    const penetration = radiusSum - radialDist;
    const point = vadd(cpA, vscale(normal, A.radius - penetration * 0.5));
    return { hit: true, parallel: true, cpA, cpB, dist: radialDist, radiusSum, normal, penetration, point };
  }

  // Non-parallel: closest points between the two axis segments.
  const seg = closestPointSegmentSegment(A.a, A.b, B.a, B.b);
  const cpA = seg.p;
  const cpB = seg.q;
  const delta = vsub(cpB, cpA);
  const dist = vlen(delta);
  if (dist > radiusSum) {
    return { hit: false, parallel: false, cpA, cpB, dist, radiusSum, normal: null, penetration: 0, point: null };
  }
  const normal = dist > EPS ? vscale(delta, 1 / dist) : [-uA[1], uA[0]];
  const penetration = radiusSum - dist;
  const point = vadd(cpA, vscale(normal, A.radius - penetration * 0.5));
  return { hit: true, parallel: false, cpA, cpB, dist, radiusSum, normal, penetration, point };
}

/**
 * Box vs cylinder (side view → box vs capsule). The exact 2D reduction:
 * the distance between a convex box and the cylinder axis is the minimum of
 * the four segment-to-edge distances, so take the closest points between the
 * axis segment and each box edge, keep the nearest pair, then compare against
 * the cylinder radius. (The 3D engine approximates this with sampling + one
 * refinement step; the exact edge sweep below is the same idea made precise.)
 */
export function boxCapsule(box, cap) {
  const corners = boxCorners(box);
  let best = null;
  for (let i = 0; i < 4; i++) {
    const ea = corners[i];
    const eb = corners[(i + 1) % 4];
    const seg = closestPointSegmentSegment(cap.a, cap.b, ea, eb);
    const delta = vsub(seg.p, seg.q); // axis point − box point
    const dSq = vdot(delta, delta);
    if (!best || dSq < best.dSq) best = { dSq, axis: seg.p, boxPoint: seg.q };
  }

  const delta = vsub(best.axis, best.boxPoint);
  const dist = vlen(delta);
  if (dist > cap.radius) {
    return { hit: false, axis: best.axis, boxPoint: best.boxPoint, dist, normal: null, penetration: 0, point: null };
  }
  const normal = dist > EPS ? vscale(delta, 1 / dist) : [0, 1];
  return { hit: true, axis: best.axis, boxPoint: best.boxPoint, dist, normal, penetration: cap.radius - dist, point: best.boxPoint };
}
