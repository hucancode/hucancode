import { m3MulV, m3AxisAngle, vAdd, vSub, vScale, vNorm, vLen, vCross } from "../math/mat3.js";

// ---- HOMING FLIGHT -------------------------------------------------------
// The assembly's group flight: a formed group is a rigid agent (position +
// heading + speed) that CHASES its moving mount point in world space, like
// a missile — turn-rate-clamped seek toward an approach gate on the mount
// normal, then a capture blend that lands it exactly in the live seat.
//
// Everything is deterministic: fixed integration steps anchored at k/steps
// of the travel window, and all per-group variation hashed off the group
// index — re-simulating from the start at any scrub position replays the
// exact same trajectory. Times (`tau`) are fractions of the travel window.

// deterministic per-index random in [0,1) — the assembly's only RNG
export function hash01(i, salt) {
  let h = (Math.imul(i, 374761393) + Math.imul(salt, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp3 = (a, b, w) => [
  a[0] + (b[0] - a[0]) * w,
  a[1] + (b[1] - a[1]) * w,
  a[2] + (b[2] - a[2]) * w,
];

// unit vector perpendicular to n, rotated az radians around n — a stable
// basis for hashed kick directions
export function lateralDir(n, az) {
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = vNorm(vCross(ref, n));
  const v = vCross(n, u);
  return vAdd(vScale(u, Math.cos(az)), vScale(v, Math.sin(az)));
}

// hashed per-group flight knobs. `far` scales speed so far parks fly faster
// and every group's flight fills its travel window. Salt 25 (dock) and 27
// (kick azimuth) are inherited from the dock-path era so depths and launch
// sides stay familiar across the swap.
export function homingParams(gi, far, A) {
  return {
    steps: A.steps,
    capture: A.capture,
    speed: far * (A.speed[0] + (A.speed[1] - A.speed[0]) * hash01(gi, 40)),
    turn: A.turn[0] + (A.turn[1] - A.turn[0]) * hash01(gi, 41),
    dock: A.dock[0] + (A.dock[1] - A.dock[0]) * hash01(gi, 25),
    kickAz: Math.PI * 2 * hash01(gi, 27),
    kickMix: A.kick[0] + (A.kick[1] - A.kick[0]) * hash01(gi, 42),
  };
}

const SPEED_RAMP = 0.4;   // fraction of the flight spent throttling up

// fixed-step seek integrator. `aimAt(tau)` -> { seat, n } in world space
// (the mount point and its normal at that moment of the flight). `onStep`
// (optional) observes every completed step boundary — the viz tracer uses
// it. Heading is kept separate from speed so it survives zero-speed steps.
function integrate(from, n0, tauEnd, P, aimAt, onStep) {
  const pos = [from[0], from[1], from[2]];
  // launch kick: hashed lateral/outward mix — groups pop out of their parked
  // spot instead of diving straight at the seat
  let head = vNorm(vAdd(
    vScale(lateralDir(n0, P.kickAz), P.kickMix),
    vScale(n0, 1 - P.kickMix),
  ));
  const kEnd = Math.max(0, Math.min(1, tauEnd)) * P.steps;
  for (let k = 0; k < kEnd; k++) {
    const h = Math.min(1, kEnd - k) / P.steps;       // tau-length (partial last step)
    const tk = k / P.steps;
    const { seat, n } = aimAt(tk);
    // aim at the gate on the normal; inside the capture window the aim
    // slides down to the seat so terminal steering already points down the
    // plug axis before the blend takes over
    let aim = [seat[0] + n[0] * P.dock, seat[1] + n[1] * P.dock, seat[2] + n[2] * P.dock];
    const cw = (tk - (1 - P.capture)) / P.capture;
    if (cw > 0) aim = lerp3(aim, seat, smooth(cw));
    const to = vSub(aim, pos), d = vLen(to);
    if (d > 1e-6) {
      const want = vScale(to, 1 / d);
      const dot = Math.max(-1, Math.min(1, head[0] * want[0] + head[1] * want[1] + head[2] * want[2]));
      const ang = Math.acos(dot);
      if (ang > 1e-6) {
        const ax = vCross(head, want), sl = vLen(ax);
        // anti-parallel: no cross axis — pick the deterministic lateral basis
        const axis = sl > 1e-6 ? vScale(ax, 1 / sl) : lateralDir(head, 0);
        head = vNorm(m3MulV(
          m3AxisAngle(axis[0], axis[1], axis[2], Math.min(ang, P.turn * h)),
          head,
        ));
      }
    }
    // arrival damping: throttle down near the aim so the group settles onto
    // the gate instead of orbiting it (turn radius shrinks with speed)
    const arr = 0.35 + 0.65 * Math.min(1, d / (2 * P.dock));
    const sp = P.speed * smooth(tk / SPEED_RAMP) * arr;
    pos[0] += head[0] * sp * h;
    pos[1] += head[1] * sp * h;
    pos[2] += head[2] * sp * h;
    if (onStep) onStep(Math.min((k + 1) / P.steps, 1), pos, head);
  }
  return { p: pos, dir: head };
}

// simulated flight state at tau (0..1 of the travel window) — re-runs the
// fixed-step integration from launch every call (scrub-safe)
export function simulateHoming(from, n0, tau, P, aimAt) {
  return integrate(from, n0, tau, P, aimAt);
}

// Capture: over the last `capture` fraction of the flight, blend the
// simulated state onto a plug-in run down the LIVE mount normal, ending
// exactly in the seat with the heading exactly on -n (so the bank derived
// from it unwinds to identity). Smoothstep weight -> C1 at both ends:
// no kink leaving the sim, no snap into the seat.
export function captureBlend(sim, seatLive, nLive, tau, P) {
  const x = Math.max(0, Math.min(1, (tau - (1 - P.capture)) / P.capture));
  if (x <= 0) return sim;
  const w = x * x * (3 - 2 * x);
  const depth = P.dock * (1 - easeInOutCubic(x));
  const ins = [
    seatLive[0] + nLive[0] * depth,
    seatLive[1] + nLive[1] * depth,
    seatLive[2] + nLive[2] * depth,
  ];
  const d = vAdd(vScale(sim.dir, 1 - w), vScale(nLive, -w));
  const l = vLen(d);
  return {
    p: lerp3(sim.p, ins, w),
    dir: l > 1e-6 ? vScale(d, 1 / l) : vScale(nLive, -1),
  };
}
