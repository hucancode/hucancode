// auto-fly rosette walk: a frame of mutually tangent circles (grand circle +
// vesica pair + medium ring); the tip rides circular arcs and may branch onto
// the touching circle at each tangency point. Alternating-tangent joins keep
// the path C1 everywhere.
// Deliberately self-contained (ink-dragon imports nothing from other
// playgrounds) even though main/frame-path.js walks a similar figure.

const TAU = Math.PI * 2;
const TAN_EPS = 1e-4; // tangency / coincident-point tolerance
const BRANCH_P = 0.5; // chance to switch circles at a touching point
const ROSETTE_R = 0.45; // grand-circle radius (world units)
// arcs a single step may cross. smallest circle r >= 0.5*ROSETTE_R*sin(pi/8)
// -> a half-arc is ~0.13 world units; at the 5.0 speed cap and the engine's
// 0.05s dt clamp a step advances <= 0.25, so 8 hops is unreachable slack.
const MAX_HOPS = 8;

// Every tangency is wired on BOTH circles as
// { a: angle here, j: partner index, aj: angle on partner }.
function buildRosette() {
  const R = ROSETTE_R;
  const circles = [{ cx: 0, cy: 0, r: R }];
  const ir = 0.5 * R;
  const axis = Math.PI / 8; // vesica axis offset off the ring spokes
  for (const s of [1, -1]) {
    circles.push({ cx: s * ir * Math.cos(axis), cy: s * ir * Math.sin(axis), r: ir });
  }
  const N = 8;
  const s = Math.sin(Math.PI / N);
  const rmed = Math.min(0.7 * R, (R * s) / (1 - s)); // clamp: ring neighbours touch, never overlap
  for (let k = 0; k < N; k++) {
    const a = k * (TAU / N);
    circles.push({ cx: (R + rmed) * Math.cos(a), cy: (R + rmed) * Math.sin(a), r: rmed });
  }
  for (const c of circles) c.tan = [];
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      const a = circles[i], b = circles[j];
      const dx = b.cx - a.cx, dy = b.cy - a.cy;
      const d = Math.hypot(dx, dy) || 1e-9;
      const ext = Math.abs(d - (a.r + b.r)) < TAN_EPS;
      const int = Math.abs(d - Math.abs(a.r - b.r)) < TAN_EPS;
      if (!ext && !int) continue;
      let px, py;
      if (ext) {
        px = a.cx + (dx / d) * a.r;
        py = a.cy + (dy / d) * a.r;
      } else {
        const aBig = a.r >= b.r;
        const big = aBig ? a : b, sgn = aBig ? 1 : -1;
        px = big.cx + ((sgn * dx) / d) * big.r;
        py = big.cy + ((sgn * dy) / d) * big.r;
      }
      const ai = Math.atan2(py - a.cy, px - a.cx);
      const aj = Math.atan2(py - b.cy, px - b.cx);
      a.tan.push({ a: ai, j, aj });
      b.tan.push({ a: aj, j: i, aj: ai });
    }
  }
  return circles;
}

export function createWalker() {
  let circles = null; // deterministic frame: built once, shared with the debug overlay
  let rs = null; // { ci, ang, dir, swept }
  const tip = { x: 0, y: 0 };

  function setTip(c, a) {
    tip.x = c.cx + c.r * Math.cos(a);
    tip.y = c.cy + c.r * Math.sin(a);
  }

  return {
    get circles() { return (circles ??= buildRosette()); },
    get tip() { return tip; },
    get seeded() { return rs !== null; },
    reset() { rs = null; },

    // head = { pos, dir }: on seed, enter the grand circle at the angle nearest
    // the head, riding the direction whose tangent best matches its heading.
    step(dt, speed, head) {
      const cs = this.circles;
      if (!rs) {
        const ang = Math.atan2(head.pos.y, head.pos.x);
        const dir = -Math.sin(ang) * head.dir.x + Math.cos(ang) * head.dir.y >= 0 ? 1 : -1;
        rs = { ci: 0, ang, dir, swept: 0 };
        setTip(cs[0], ang);
      }
      let remaining = speed * dt;
      for (let hop = 0; hop < MAX_HOPS && remaining > 1e-6; hop++) {
        const c = cs[rs.ci];
        // nearest tangency ahead in travel direction
        let best = null, bestSweep = Infinity;
        for (const tp of c.tan) {
          let sweep = (((rs.dir * (tp.a - rs.ang)) % TAU) + TAU) % TAU;
          if (sweep < TAN_EPS) sweep += TAU; // skip point we're sitting on
          if (sweep < bestSweep) { bestSweep = sweep; best = tp; }
        }
        const arcToTan = c.r * bestSweep;
        if (!best || remaining < arcToTan) {
          rs.ang += (rs.dir * remaining) / c.r;
          rs.swept += remaining / c.r;
          break;
        }
        remaining -= arcToTan;
        rs.swept += bestSweep;
        rs.ang = best.a;
        // commit to at least half a circle before peeling off (no quick in/out);
        // branch preserves the tangent -> derive partner's travel direction
        if (rs.swept >= Math.PI - TAN_EPS && Math.random() < BRANCH_P) {
          const tx = rs.dir * -Math.sin(rs.ang), ty = rs.dir * Math.cos(rs.ang);
          const ndir = tx * -Math.sin(best.aj) + ty * Math.cos(best.aj) >= 0 ? 1 : -1;
          rs.ci = best.j;
          rs.ang = best.aj;
          rs.dir = ndir;
          rs.swept = 0;
        }
      }
      setTip(cs[rs.ci], rs.ang);
      return tip;
    },
  };
}
