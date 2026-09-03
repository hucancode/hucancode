// Shared 3D-surface helpers for the Intro to Calculus playgrounds.

/**
 * Arrowhead triangle for a 2D screen-space segment (x1,y1) -> (x2,y2).
 * The tip lands on (x2,y2); returns an SVG path string.
 */
export function arrowHeadPath(x1, y1, x2, y2, size = 10) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return "";
  const ux = dx / len;
  const uy = dy / len;
  // perpendicular (counter-clockwise in screen space)
  const px = -uy;
  const py = ux;
  const bx = x2 - ux * size;
  const by = y2 - uy * size;
  const w = size * 0.45;
  return (
    `M${x2.toFixed(2)},${y2.toFixed(2)}` +
    `L${(bx + px * w).toFixed(2)},${(by + py * w).toFixed(2)}` +
    `L${(bx - px * w).toFixed(2)},${(by - py * w).toFixed(2)}Z`
  );
}

/** Project an array of [x, y, z] world points into an SVG path string. */
export function projectPath(points, project) {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const s = project(p[0], p[1], p[2]);
    d += `${i === 0 ? "M" : "L"}${s.x.toFixed(2)},${s.y.toFixed(2)}`;
  }
  return d;
}
