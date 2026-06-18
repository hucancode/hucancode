// The 2D ink dragon's kinematic body: a chain of BODY_N points trailing the head.
// Two modes — refit ON the motion line each frame (physics off, the default), or
// a verlet chain that lags the tip. createBodyController owns the chain + scratch
// and exposes reseed / step / writeHead. It reads the head sampler (posAt) so the
// trail flows across phase seams.

import { lerp } from "$lib/math/scalar.js";
import { BODY_N, BODY_LEN, PROP_SPEED, MAX_BEND } from "./config.js";

export function createBodyController({ headPath, timing }) {
  const { posAt } = headPath;
  let body = [];
  let _next = null; // persistent scratch chain swapped with body in step (no per-frame alloc)

  // Fit the body ALONG the motion line: head at the path point for t, the rest
  // trailing back by arc length. Walk backward IN SCENE-TIME through the global
  // sampler (posAt), NOT the current phase's own parameter — so the trail flows
  // across phase seams. Used on seek (no teleport) and every frame when physics
  // is disabled.
  function reseed(t, len = BODY_LEN) {
    const dt = 0.004;             // scene-time step walking backward from the head
    const t0 = timing.dragonStart; // the dragon does not exist before this -> floor
    const tHead = Math.min(Math.max(t, t0), timing.branch); // head holds at the branch in loop3
    const head = posAt(tHead);
    const pts = [{ x: head.x, y: head.y }];
    const arcs = [0];
    let prev = pts[0], acc = 0, tt = tHead;
    while (acc < len && tt > t0) {
      tt = Math.max(t0, tt - dt);
      const q = posAt(tt);
      acc += Math.hypot(q.x - prev.x, q.y - prev.y);
      pts.push({ x: q.x, y: q.y }); arcs.push(acc); prev = pts[pts.length - 1];
    }
    body = new Array(BODY_N);
    // degenerate: head sits at the timeline start (no trail yet) -> collapse the
    // whole body onto the head point.
    if (pts.length < 2) {
      for (let i = 0; i < BODY_N; i++) body[i] = { x: pts[0].x, y: pts[0].y };
      return;
    }
    for (let i = 0; i < BODY_N; i++) {
      const back = (1 - i / (BODY_N - 1)) * len; // i=N-1 head .. i=0 tail
      let lo = 0, hi = arcs.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (arcs[mid] < back) lo = mid + 1; else hi = mid; }
      const j = Math.min(Math.max(1, lo), pts.length - 1);
      const seg = arcs[j] - arcs[j - 1] || 1e-6;
      const k = (back - arcs[j - 1]) / seg;
      body[i] = { x: lerp(pts[j - 1].x, pts[j].x, k), y: lerp(pts[j - 1].y, pts[j].y, k) };
    }
  }

  function ensureNext(n) {
    if (_next && _next.length === n) return;
    _next = new Array(n);
    for (let i = 0; i < n; i++) _next[i] = { x: 0, y: 0 };
  }

  // Verlet chain trailing the tip target: distance constraint back from the tip,
  // max-bend clamp, forward re-constraint.
  function step(tip, len = BODY_LEN) {
    const N = body.length;
    if (N < 2) return;
    const linkLen = len / (N - 1);
    const speed = PROP_SPEED;
    ensureNext(N);
    const next = _next;
    for (let i = 0; i < N; i++) { next[i].x = body[i].x; next[i].y = body[i].y; }
    next[N - 1].x = tip.x; next[N - 1].y = tip.y;

    for (let i = N - 2; i >= 0; i--) {
      const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const inv = ((d - linkLen) * speed) / d;
        next[i].x += dx * inv; next[i].y += dy * inv;
      }
    }

    if (MAX_BEND < Math.PI - 1e-3 && N >= 3) {
      const minCos = -Math.cos(MAX_BEND);
      for (let i = N - 2; i >= 1; i--) {
        const tipP = next[i + 1], mid = next[i], head = next[i - 1];
        const ax = tipP.x - mid.x, ay = tipP.y - mid.y;
        const bx = head.x - mid.x, by = head.y - mid.y;
        const aLen = Math.hypot(ax, ay), bLen = Math.hypot(bx, by);
        if (aLen < 1e-6 || bLen < 1e-6) continue;
        const adx = ax / aLen, ady = ay / aLen, bdx = bx / bLen, bdy = by / bLen;
        const cosAng = adx * bdx + ady * bdy;
        if (cosAng > minCos) {
          const curAng = Math.atan2(adx * bdy - ady * bdx, adx * bdx + ady * bdy);
          const sgn = curAng >= 0 ? 1 : -1;
          const targetAng = (Math.PI - MAX_BEND) * sgn;
          const newAng = curAng + (targetAng - curAng) * speed;
          const c = Math.cos(newAng), s = Math.sin(newAng);
          next[i - 1].x = mid.x + (adx * c - ady * s) * bLen;
          next[i - 1].y = mid.y + (adx * s + ady * c) * bLen;
        }
      }
      for (let i = N - 2; i >= 0; i--) {
        const dx = next[i + 1].x - next[i].x, dy = next[i + 1].y - next[i].y;
        const d = Math.hypot(dx, dy);
        if (d > linkLen && d > 1e-6) {
          const inv = ((d - linkLen) * speed) / d;
          next[i].x += dx * inv; next[i].y += dy * inv;
        }
      }
    }
    // swap: result becomes body, old body becomes the reusable scratch (no alloc)
    _next = body;
    body = next;
  }

  // Write the head pose (neck-offset position + heading) into `head` in place.
  // The head aligns with the true PATH tangent at the tip when given — the verlet
  // body chain lags on curves, so its last-segment heading drifts off the edge
  // tangent; fall back to that heading only if the tangent is degenerate.
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

  return {
    get body() { return body; },
    reseed, step, writeHead,
  };
}
