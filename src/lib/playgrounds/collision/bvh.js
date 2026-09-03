// Bounding volume hierarchies for cheap pair culling.
//
// Before running the exact primitive tests, we need to answer "which pairs are
// even close enough to test?" without checking every pair. The BVH here uses
// the cheapest volume there is — an axis-aligned box (AABB) — as every node.
// AABBs are trivial to build, merge, and test, which is exactly what a
// hierarchy of hundreds of moving objects needs.
//
//   • aabbOverlap      — the O(1) reject test (two interval overlaps).
//   • buildBVH         — recursive median split along the widest axis.
//   • queryBVH         — walk the tree, prune branches that miss a query box.

// ---- AABB ---------------------------------------------------------------

export function aabbOfPoints(points) {
  let min = [Infinity, Infinity];
  let max = [-Infinity, -Infinity];
  for (const p of points) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1])];
  }
  return { min, max };
}

export function aabbMerge(a, b) {
  return {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1])],
  };
}

export function aabbOverlap(a, b) {
  return (
    a.min[0] <= b.max[0] &&
    a.max[0] >= b.min[0] &&
    a.min[1] <= b.max[1] &&
    a.max[1] >= b.min[1]
  );
}

export function aabbCenter(a) {
  return [(a.min[0] + a.max[0]) / 2, (a.min[1] + a.max[1]) / 2];
}

/** AABB of a shape: circle, axis-aligned box, or capsule (cylinder side view). */
export function aabbOfShape(s) {
  if (s.type === "circle") {
    return { min: [s.c[0] - s.r, s.c[1] - s.r], max: [s.c[0] + s.r, s.c[1] + s.r] };
  }
  if (s.type === "box") {
    return { min: [s.c[0] - s.h[0], s.c[1] - s.h[1]], max: [s.c[0] + s.h[0], s.c[1] + s.h[1]] };
  }
  // capsule: axis segment [a, b] inflated by r
  const pts = [
    [s.a[0] - s.r, s.a[1] - s.r],
    [s.a[0] + s.r, s.a[1] + s.r],
    [s.b[0] - s.r, s.b[1] - s.r],
    [s.b[0] + s.r, s.b[1] + s.r],
  ];
  return aabbOfPoints(pts);
}

// ---- tree ---------------------------------------------------------------

/**
 * Build a balanced BVH. Each node is an AABB; leaves hold one object each.
 * At every split the widest axis is sorted by box center and cut at the
 * median — simple, deterministic, and O(n log n).
 */
export function buildBVH(objects) {
  const items = objects.map((o) => ({ object: o, aabb: aabbOfShape(o) }));

  function build(list, depth) {
    if (list.length === 0) return null;
    const aabb = list
      .slice(1)
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
      aabb,
      depth,
      leaf: null,
      left: build(sorted.slice(0, mid), depth + 1),
      right: build(sorted.slice(mid), depth + 1),
    };
  }

  return build(items, 0);
}

/**
 * Query the tree. A branch whose box misses the query box is pruned in one
 * check; every leaf whose box overlaps the query is a candidate to test.
 */
export function queryBVH(node, query) {
  const visited = [];
  const pruned = [];
  const candidates = [];

  function walk(n) {
    if (!n) return;
    if (!aabbOverlap(n.aabb, query)) {
      pruned.push(n);
      return;
    }
    visited.push(n);
    if (n.leaf) candidates.push(n.leaf);
    else {
      walk(n.left);
      walk(n.right);
    }
  }
  walk(node);
  return { visited, pruned, candidates };
}

// ---- inspection helpers (for the demos) ----------------------------------

export function nodesAtDepth(node, depth, out = []) {
  if (!node) return out;
  if (node.depth === depth) {
    out.push(node);
    return out;
  }
  if (node.depth < depth) {
    nodesAtDepth(node.left, depth, out);
    nodesAtDepth(node.right, depth, out);
  }
  return out;
}

export function maxDepth(node) {
  if (!node) return 0;
  if (node.leaf) return node.depth;
  return Math.max(maxDepth(node.left), maxDepth(node.right));
}

export function countNodes(node) {
  if (!node) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

// ---- sample scene --------------------------------------------------------

/** 24 axis-aligned boxes in four clusters — enough to make the tree interesting. */
export function sampleScene() {
  return [
    { id: 0, type: "box", c: [-3.4, 1.8], h: [0.25, 0.17], emoji: "🍎" },
    { id: 1, type: "box", c: [-2.9, 1.7], h: [0.15, 0.12], emoji: "🍌" },
    { id: 2, type: "box", c: [-3.2, 1.2], h: [0.19, 0.15], emoji: "🍇" },
    { id: 3, type: "box", c: [-2.6, 1.4], h: [0.2, 0.13], emoji: "🍓" },
    { id: 4, type: "box", c: [-3.6, 1.4], h: [0.16, 0.14], emoji: "🍒" },
    { id: 5, type: "box", c: [-2.8, 0.9], h: [0.22, 0.16], emoji: "🍑" },
    { id: 6, type: "box", c: [-2.0, -1.9], h: [0.25, 0.2], emoji: "🍍" },
    { id: 7, type: "box", c: [-1.4, -1.8], h: [0.15, 0.12], emoji: "🥝" },
    { id: 8, type: "box", c: [-1.8, -1.3], h: [0.18, 0.14], emoji: "🍉" },
    { id: 9, type: "box", c: [-1.1, -1.5], h: [0.2, 0.15], emoji: "🍊" },
    { id: 10, type: "box", c: [-2.4, -1.5], h: [0.14, 0.13], emoji: "🍋" },
    { id: 11, type: "box", c: [0.0, 0.6], h: [0.13, 0.1], emoji: "🫐" },
    { id: 12, type: "box", c: [0.6, 0.7], h: [0.16, 0.12], emoji: "🥭" },
    { id: 13, type: "box", c: [0.3, 0.0], h: [0.2, 0.15], emoji: "🍐" },
    { id: 14, type: "box", c: [0.9, 0.2], h: [0.14, 0.11], emoji: "🍈" },
    { id: 15, type: "box", c: [-0.3, -0.4], h: [0.18, 0.14], emoji: "🍏" },
    { id: 16, type: "box", c: [1.3, 0.8], h: [0.15, 0.12], emoji: "🫒" },
    { id: 17, type: "box", c: [2.2, 0.8], h: [0.23, 0.18], emoji: "🥥" },
    { id: 18, type: "box", c: [3.0, 0.9], h: [0.14, 0.11], emoji: "🍅" },
    { id: 19, type: "box", c: [2.6, 0.0], h: [0.2, 0.15], emoji: "🥕" },
    { id: 20, type: "box", c: [3.4, 0.1], h: [0.16, 0.13], emoji: "🌽" },
    { id: 21, type: "box", c: [2.4, -0.9], h: [0.22, 0.16], emoji: "🍆" },
    { id: 22, type: "box", c: [3.1, -0.8], h: [0.15, 0.12], emoji: "🥔" },
    { id: 23, type: "box", c: [3.6, -0.4], h: [0.18, 0.14], emoji: "🧅" },
  ];
}
