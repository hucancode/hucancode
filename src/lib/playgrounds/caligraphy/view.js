// World coords: x in [-aspect,+aspect], y in [-1,+1], origin centred.
// view: { zoom, panX, panY } applied as pScreen = view((p - pan) * zoom).
// Everything here is CSS px in / world out (or the inverse); the canvas
// backing-store scale never enters this math.

export function worldToScreen(p, w, h, view) {
  const aspect = w / h;
  const vx = (p.x - view.panX) * view.zoom;
  const vy = (p.y - view.panY) * view.zoom;
  return { x: ((vx / aspect + 1) / 2) * w, y: (1 - (vy + 1) / 2) * h };
}

export function screenToWorld(x, y, w, h, view) {
  const aspect = w / h;
  const vx = ((x / w) * 2 - 1) * aspect;
  const vy = (1 - y / h) * 2 - 1;
  return { x: vx / view.zoom + view.panX, y: vy / view.zoom + view.panY };
}

// wheel zoom anchored at the cursor: the world point under (sx,sy) stays put.
export function zoomAt(view, sx, sy, deltaY, w, h) {
  const before = screenToWorld(sx, sy, w, h, view);
  view.zoom = Math.max(0.2, Math.min(20, view.zoom * Math.exp(-deltaY * 0.0015)));
  const after = screenToWorld(sx, sy, w, h, view);
  view.panX += before.x - after.x;
  view.panY += before.y - after.y;
}

// dx,dy in screen px (drag delta)
export function panBy(view, dx, dy, w, h) {
  const aspect = w / h;
  view.panX -= ((dx / w) * 2 * aspect) / view.zoom;
  view.panY += ((dy / h) * 2) / view.zoom;
}

export function resetView(view) {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
}
