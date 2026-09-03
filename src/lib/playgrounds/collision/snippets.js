// Code snippets shown inside <details> on the collision page.
// Each block is the JavaScript for one demo.

export const jsSphereSphere = `import { vsub, vadd, vscale, vlen } from "./sat.js";

export function circleCircle(a, b) {
  const delta = vsub(b.center, a.center);
  const dist = vlen(delta);
  const radiusSum = a.radius + b.radius;
  if (dist > radiusSum) {
    return { hit: false, normal: null, penetration: 0, point: null };
  }
  const normal = dist > 1e-6 ? vscale(delta, 1 / dist) : [0, 1];
  const penetration = radiusSum - dist;
  const point = vadd(a.center, vscale(normal, a.radius - penetration * 0.5));
  return { hit: true, normal, penetration, point };
}`;

export const jsSphereBox = `import { vsub, vadd, vscale, vdot, vlen, clamp } from "./sat.js";

export function closestPointOnBox(box, p) {
  const d = vsub(p, box.center);
  const lx = clamp(vdot(d, box.axes[0]), -box.half[0], box.half[0]);
  const ly = clamp(vdot(d, box.axes[1]), -box.half[1], box.half[1]);
  return vadd(vadd(box.center, vscale(box.axes[0], lx)), vscale(box.axes[1], ly));
}

export function circleBox(circle, box) {
  const closest = closestPointOnBox(box, circle.center);
  const delta = vsub(circle.center, closest);
  const dist = vlen(delta);
  if (dist > circle.radius) {
    return { hit: false, closest, normal: null, penetration: 0 };
  }
  const normal = dist > 1e-6 ? vscale(delta, -1 / dist) : [0, 1];
  return { hit: true, closest, normal, penetration: circle.radius - dist };
}`;

export const jsSphereCylinder = `import { vsub, vadd, vscale, vdot, vlen, clamp } from "./sat.js";

export function closestPointOnSegment(p, a, b) {
  const ab = vsub(b, a);
  const len2 = vdot(ab, ab);
  let t = 0;
  if (len2 > 1e-12) t = clamp(vdot(vsub(p, a), ab) / len2, 0, 1);
  return { point: vadd(a, vscale(ab, t)), t };
}

export function circleCapsule(circle, cap) {
  const axis = closestPointOnSegment(circle.center, cap.a, cap.b);
  const delta = vsub(circle.center, axis.point);
  const dist = vlen(delta);
  const region = axis.t > 1e-3 && axis.t < 1 - 1e-3 ? "side" : "cap";
  if (dist > circle.radius + cap.radius) {
    return { hit: false, axis: axis.point, region, normal: null, penetration: 0 };
  }
  const normal = dist > 1e-6 ? vscale(delta, -1 / dist) : [0, 1];
  const surface = vadd(axis.point, vscale(normal, cap.radius));
  const penetration = circle.radius + cap.radius - dist;
  const point = vadd(surface, vscale(normal, penetration * 0.5));
  return { hit: true, axis: axis.point, region, normal, penetration, point, surface };
}`;

export const jsSat = `const vdot = (a, b) => a[0] * b[0] + a[1] * b[1];

export function boxFrame(center, half, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return {
    center, half, angle,
    axes: [[c, s], [-s, c]],
  };
}

export function projectBox(f, n) {
  const ext =
    f.half[0] * Math.abs(vdot(f.axes[0], n)) +
    f.half[1] * Math.abs(vdot(f.axes[1], n));
  const c = vdot(f.center, n);
  return { min: c - ext, max: c + ext, ext };
}

export function satTest(fa, fb) {
  const d = [fb.center[0] - fa.center[0], fb.center[1] - fa.center[1]];
  const axes = [
    { n0: fa.axes[0], owner: 0, face: 0, label: "A.x" },
    { n0: fa.axes[1], owner: 0, face: 1, label: "A.y" },
    { n0: fb.axes[0], owner: 1, face: 0, label: "B.x" },
    { n0: fb.axes[1], owner: 1, face: 1, label: "B.y" },
  ];

  const results = axes.map(({ n0, owner, face, label }) => {
    const axis = vdot(d, n0) >= 0 ? n0 : [-n0[0], -n0[1]];
    const pa = projectBox(fa, axis);
    const pb = projectBox(fb, axis);
    const overlap = Math.min(pa.max, pb.max) - Math.max(pa.min, pb.min);
    return { axis, owner, face, label, pa, pb, overlap };
  });

  let min = results[0], minIndex = 0;
  results.forEach((r, i) => {
    if (r.overlap < min.overlap) { min = r; minIndex = i; }
  });

  const hit = results.every((r) => r.overlap >= 0);
  return {
    hit,
    results,
    min, minIndex,
    normal: hit ? min.axis : null,
    penetration: hit ? min.overlap : 0,
  };
}`;

export const jsCylinderCylinder = `import { vsub, vadd, vscale, vdot, clamp } from "./sat.js";

export function closestPointSegmentSegment(p0, p1, q0, q1) {
  const d1 = vsub(p1, p0);
  const d2 = vsub(q1, q0);
  const r  = vsub(p0, q0);
  const a = vdot(d1, d1);
  const e = vdot(d2, d2);
  const f = vdot(d2, r);

  let s = 0, t = 0;
  if (a <= 1e-12 && e <= 1e-12) {
    s = 0; t = 0;
  } else if (a <= 1e-12) {
    s = 0; t = clamp(f / e, 0, 1);
  } else {
    const c = vdot(d1, r);
    if (e <= 1e-12) {
      t = 0; s = clamp(-c / a, 0, 1);
    } else {
      const b = vdot(d1, d2);
      const denom = a * e - b * b;
      s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0)      { t = 0; s = clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); }
    }
  }

  return {
    p: vadd(p0, vscale(d1, s)),
    q: vadd(q0, vscale(d2, t)),
    s, t,
  };
}`;

export const jsBoxCylinder = `import { vsub, vscale, vdot, vlen } from "./sat.js";

export function boxCapsule(box, cap) {
  const corners = boxCorners(box);
  let best = null;
  for (let i = 0; i < 4; i++) {
    const ea = corners[i];
    const eb = corners[(i + 1) % 4];
    const seg = closestPointSegmentSegment(cap.a, cap.b, ea, eb);
    const delta = vsub(seg.p, seg.q);
    const dSq = vdot(delta, delta);
    if (!best || dSq < best.dSq) best = { dSq, axis: seg.p, boxPoint: seg.q };
  }

  const delta = vsub(best.axis, best.boxPoint);
  const dist = vlen(delta);
  if (dist > cap.radius) {
    return { hit: false, axis: best.axis, boxPoint: best.boxPoint, dist, normal: null, penetration: 0 };
  }
  const normal = dist > 1e-6 ? vscale(delta, 1 / dist) : [0, 1];
  return { hit: true, axis: best.axis, boxPoint: best.boxPoint, dist, normal, penetration: cap.radius - dist };
}`;

export const jsAabb = `export function aabbOverlap(a, b) {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0] &&
         a.min[1] <= b.max[1] && a.max[1] >= b.min[1];
}

export function aabbMerge(a, b) {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1])],
  };
}

export function aabbOfBox(c, h) {
  return { min: [c[0] - h[0], c[1] - h[1]], max: [c[0] + h[0], c[1] + h[1]] };
}`;

export const jsBuildBVH = `export function buildBVH(objects) {
  const items = objects.map((o) => ({ object: o, aabb: aabbOfShape(o) }));

  function build(list, depth) {
    const aabb = list.slice(1)
      .reduce((acc, it) => aabbMerge(acc, it.aabb), list[0].aabb);
    if (list.length === 1) {
      return { aabb, depth, leaf: list[0].object, left: null, right: null };
    }

    const wide = aabb.max[0] - aabb.min[0] >= aabb.max[1] - aabb.min[1] ? 0 : 1;
    const sorted = list.slice().sort((a, b) => {
      const ca = (a.aabb.min[wide] + a.aabb.max[wide]) / 2;
      const cb = (b.aabb.min[wide] + b.aabb.max[wide]) / 2;
      return ca - cb;
    });
    const mid = Math.floor(sorted.length / 2);
    return {
      aabb, depth, leaf: null,
      left: build(sorted.slice(0, mid), depth + 1),
      right: build(sorted.slice(mid), depth + 1),
    };
  }

  return build(items, 0);
}`;

export const jsQueryBVH = `export function queryBVH(node, query) {
  const pruned = [];
  const candidates = [];

  function walk(n) {
    if (!aabbOverlap(n.aabb, query)) { pruned.push(n); return; }
    if (n.leaf) { candidates.push(n.leaf); }
    else { walk(n.left); walk(n.right); }
  }
  walk(node);
  return { pruned, candidates };
}`;
