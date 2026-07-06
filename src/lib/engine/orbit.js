// Orbit-drag camera controls around a point on the Y axis. Pointer drag sets
// yaw/pitch; optional wheel zoom. Caller reads/writes .yaw/.pitch/.dist freely
// (auto-spin, presets) and calls placeCamera() each frame.
import { clamp } from "../math/scalar.js";

export function createOrbit(canvas, {
  yaw = 0, pitch = 0, dist = 6,
  pitchClamp = 1.3, lockPitch = false,
  wheel = false, minDist = 1.5, maxDist = 60,
} = {}) {
  let lastX = 0, lastY = 0;
  const px = (e) => (e.touches ? e.touches[0].clientX : e.clientX);
  const py = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  const o = {
    yaw, pitch, dist, dragging: false,
    placeCamera(camera, lookY = 0) {
      const cp = Math.cos(o.pitch);
      camera.position.set(
        o.dist * cp * Math.sin(o.yaw),
        lookY + o.dist * Math.sin(o.pitch),
        o.dist * cp * Math.cos(o.yaw),
      );
      camera.lookAt(0, lookY, 0);
      camera.update();
    },
    detach() {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (wheel) canvas.removeEventListener("wheel", onWheel);
    },
  };

  function onDown(e) {
    o.dragging = true;
    lastX = px(e); lastY = py(e);
  }
  function onMove(e) {
    if (!o.dragging) return;
    const x = px(e), y = py(e);
    o.yaw -= (x - lastX) * 0.01;
    if (!lockPitch) o.pitch = clamp(o.pitch + (y - lastY) * 0.01, -pitchClamp, pitchClamp);
    lastX = x; lastY = y;
  }
  function onUp() { o.dragging = false; }
  function onWheel(e) {
    e.preventDefault();
    o.dist = clamp(o.dist * (1 + Math.sign(e.deltaY) * 0.08), minDist, maxDist);
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  if (wheel) canvas.addEventListener("wheel", onWheel, { passive: false });

  return o;
}
