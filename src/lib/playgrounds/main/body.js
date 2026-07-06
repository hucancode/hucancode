import { lerp } from "$lib/math/scalar.js";
import { BODY_N, BODY_LEN } from "./config.js";

export function createBodyController({ headPath, timing }) {
  const { posAt } = headPath;
  // persistent chain (tail -> tip) + scratch trail buffers, mutated in place:
  // reseed runs every frame, so it allocates nothing
  const body = Array.from({ length: BODY_N }, () => ({ x: 0, y: 0 }));
  const _tx = [], _ty = [], _arc = [];

  // Fit body along motion line: head at path point for t, rest trailing back by
  // arc length. Walk backward in SCENE-TIME through global sampler (posAt), NOT
  // current phase's own param -> trail flows across phase seams.
  function reseed(t, len = BODY_LEN) {
    const dt = 0.004;             // scene-time step walking backward from head
    const t0 = timing.flyinStart; // dragon does not exist before this -> floor
    const tHead = Math.min(Math.max(t, t0), timing.loop3Start); // head holds at the 2D handoff
    const head = posAt(tHead);
    _tx.length = _ty.length = _arc.length = 0;
    _tx.push(head.x); _ty.push(head.y); _arc.push(0);
    let px = head.x, py = head.y, acc = 0, tt = tHead;
    while (acc < len && tt > t0) {
      tt = Math.max(t0, tt - dt);
      const q = posAt(tt);
      acc += Math.hypot(q.x - px, q.y - py);
      _tx.push(q.x); _ty.push(q.y); _arc.push(acc);
      px = q.x; py = q.y;
    }
    // degenerate: head at timeline start (no trail yet) -> collapse whole body
    // onto head point
    if (_tx.length < 2) {
      for (const b of body) { b.x = head.x; b.y = head.y; }
      return;
    }
    for (let i = 0; i < BODY_N; i++) {
      const back = (1 - i / (BODY_N - 1)) * len; // i=N-1 head .. i=0 tail
      let lo = 0, hi = _arc.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (_arc[mid] < back) lo = mid + 1; else hi = mid; }
      const j = Math.min(Math.max(1, lo), _tx.length - 1);
      const seg = _arc[j] - _arc[j - 1] || 1e-6;
      const k = (back - _arc[j - 1]) / seg;
      body[i].x = lerp(_tx[j - 1], _tx[j], k);
      body[i].y = lerp(_ty[j - 1], _ty[j], k);
    }
  }

  // Write head pose (neck-offset position + heading) into `head` in place. Head
  // aligns with true PATH tangent at tip when given; the fitted chain lags on
  // curves so its last-segment heading drifts off edge tangent. fall back to
  // that heading only if tangent degenerate.
  function writeHead(head, tangent) {
    const n = body.length;
    const tip = body[n - 1], prev = body[n - 2];
    let dx, dy;
    if (tangent && (tangent.x || tangent.y)) { dx = tangent.x; dy = tangent.y; }
    else { dx = tip.x - prev.x; dy = tip.y - prev.y; }
    const m = Math.hypot(dx, dy) || 1;
    dx /= m; dy /= m;
    const neck = 0.05;
    head.pos.x = tip.x + dx * neck;
    head.pos.y = tip.y + dy * neck;
    head.dir.x = dx;
    head.dir.y = dy;
  }

  return { body, reseed, writeHead };
}
