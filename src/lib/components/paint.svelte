<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { createRenderer } from "$lib/playgrounds/main/render/index.js";
  import { initScene, buildState } from "$lib/playgrounds/main.js";

  // Controlled canvas. The parent owns the timeline:
  //   t        scene time, bindable (parent maps scroll / autoplay onto it)
  //   playing  when true the component auto-advances t each frame
  //   fill     stretch to the parent's height instead of a 16/9 box
  let { t = $bindable(0), playing = $bindable(false), debug = {}, fill = false } = $props();

  let canvasEl;
  let renderer = null;
  let frameID = 0;
  let observer;
  let ro;
  let lastTs = null;
  let aspect = 1;

  // orbit camera: YAW only. Pitch (elevation) is fully scripted by the scene
  // (top-down 90deg during the glyph trace -> 45deg as the 3D dragon appears).
  let orbitYaw = 0;
  let dragging = false, lastX = 0;

  function onPointerDown(e) {
    if (e.pointerType !== "mouse") return; // touch -> let the page scroll/scrub
    dragging = true; lastX = e.clientX;
    canvasEl.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging || e.pointerType !== "mouse") return;
    orbitYaw = orbitYaw + (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  }
  function onPointerUp() { dragging = false; }

  function sizeCanvas() {
    if (!canvasEl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvasEl.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvasEl.clientHeight * dpr));
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
      if (renderer) renderer.resize(w, h);
    }
    aspect = h > 0 ? w / h : 1;
  }

  // Render every frame while visible (the 3D dragon loops on forever). t only
  // advances while playing; the parent moves it otherwise (scroll scrubbing).
  function tick(ts) {
    frameID = requestAnimationFrame(tick);
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (playing) t += dt; // unbounded: persistent blocks keep the dragon looping
    if (!renderer) return;
    renderer.frame(buildState(t, aspect, debug, orbitYaw));
  }

  function start() {
    if (frameID) return;
    lastTs = null;
    frameID = requestAnimationFrame(tick);
  }
  function stop() {
    if (frameID) cancelAnimationFrame(frameID);
    frameID = 0;
  }

  onMount(async () => {
    if (!browser) return;
    // debug: ?t=<seconds> renders a single paused frame at that scene time
    const qs = new URLSearchParams(location.search);
    const qt = qs.get("t");
    if (qt != null && !Number.isNaN(parseFloat(qt))) { t = parseFloat(qt); playing = false; }
    if (qs.get("play") === "1") playing = true;
    if (qs.get("debug") === "1") debug = { path2d: true, path3d: true };
    if (qs.get("yaw")) orbitYaw = parseFloat(qs.get("yaw")) || 0;
    initScene();
    sizeCanvas();
    renderer = await createRenderer(canvasEl, { prefer: "webgl" });
    sizeCanvas();

    ro = new ResizeObserver(() => sizeCanvas());
    ro.observe(canvasEl);

    observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) start();
      else stop();
    });
    observer.observe(canvasEl);
  });

  onDestroy(() => {
    stop();
    if (ro) ro.disconnect();
    if (observer) observer.disconnect();
    if (renderer) renderer.destroy();
    renderer = null;
  });
</script>

<canvas
  class:fill
  bind:this={canvasEl}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointerleave={onPointerUp}
></canvas>

<style>
  canvas {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    touch-action: pan-y;
    cursor: grab;
  }
  canvas.fill {
    height: 100%;
    aspect-ratio: auto;
  }
  canvas:active {
    cursor: grabbing;
  }
</style>
