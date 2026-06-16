<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { createRenderer } from "$lib/scenes/render/index.js";
  import { initScene, buildState, TIMELINE_END } from "$lib/scenes/paint.js";

  let canvasEl;
  let renderer = null;
  let frameID = 0;
  let observer;
  let ro;
  let lastTs = null;
  let aspect = 1;

  let t = $state(0);
  let playing = $state(true);
  let debug = $state(false);
  // debug: inspect a single offscreen buffer fullscreen
  const BUFFERS = ["none", "dragon", "trail", "glow", "glyph", "ink"];
  let debugBuffer = $state("none");

  // orbit camera (3D dragon) - limited yaw/pitch around the front view
  const PITCH_MIN = 0;             // front view
  const PITCH_MAX = Math.PI / 6;   // +30deg, look from above only
  const clampR = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  let orbitYaw = 0, orbitPitch = 0;
  let dragging = false, lastX = 0, lastY = 0;
  const orbit = () => ({ yaw: orbitYaw, pitch: orbitPitch, zoom: 1 });

  function onPointerDown(e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvasEl.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    orbitYaw = orbitYaw + (e.clientX - lastX) * 0.01;
    orbitPitch = clampR(orbitPitch + (e.clientY - lastY) * 0.01, PITCH_MIN, PITCH_MAX);
    lastX = e.clientX; lastY = e.clientY;
    if (!playing) renderPaused();
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

  function tick(ts) {
    frameID = requestAnimationFrame(tick);
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (playing) t += dt;
    if (!renderer) return;
    renderer.frame(buildState(t, aspect, debug, orbit(), debugBuffer));
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

  // Render a single paused frame. The body is fitted to the path at t (seeks
  // never teleport through a straight reseed), so no warm-up loop is needed.
  function renderPaused() {
    if (!renderer) return;
    renderer.frame(buildState(t, aspect, debug, orbit(), debugBuffer));
  }
  function onScrub() {
    if (!playing) renderPaused();
  }

  onMount(async () => {
    if (!browser) return;
    // debug: ?t=<seconds> renders a single paused frame at that scene time
    const qs = new URLSearchParams(location.search);
    const qt = qs.get("t");
    if (qt != null && !Number.isNaN(parseFloat(qt))) {
      t = parseFloat(qt);
      playing = false;
    }
    // ?play=1 keeps the clock running (lets the head-trail accumulate for tests)
    if (qs.get("play") === "1") playing = true;
    if (qs.get("debug") === "1") debug = true;
    if (qs.get("buffer") && BUFFERS.includes(qs.get("buffer"))) debugBuffer = qs.get("buffer");
    if (qs.get("yaw")) orbitYaw = parseFloat(qs.get("yaw")) || 0;
    if (qs.get("pitch")) orbitPitch = clampR(parseFloat(qs.get("pitch")) || 0, PITCH_MIN, PITCH_MAX);
    initScene();
    sizeCanvas();
    renderer = await createRenderer(canvasEl, { prefer: "webgl" });
    sizeCanvas();
    if (!playing) renderPaused();

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

<div class="paint">
  <canvas
    bind:this={canvasEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
  ></canvas>
  <div class="timeline">
    <button onclick={() => (playing = !playing)} aria-label="play/pause">
      {playing ? "⏸" : "▶"}
    </button>
    <input
      type="range"
      min="0"
      max={TIMELINE_END}
      step="0.01"
      bind:value={t}
      oninput={onScrub}
    />
    <span class="t">{t.toFixed(2)}s</span>
    <label class="dbg">
      <input type="checkbox" bind:checked={debug} onchange={onScrub} /> path
    </label>
    <label class="dbg">
      buffer
      <select bind:value={debugBuffer} onchange={onScrub}>
        {#each BUFFERS as b}
          <option value={b}>{b}</option>
        {/each}
      </select>
    </label>
  </div>
</div>

<style>
  .paint {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  canvas {
    width: 100%;
    aspect-ratio: 16 / 9;
    display: block;
    border-radius: 0.5rem;
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  .timeline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.6;
  }
  .timeline input[type="range"] {
    flex: 1;
  }
  .timeline button {
    width: 2rem;
    cursor: pointer;
  }
  .t {
    min-width: 3.5rem;
    text-align: right;
  }
  .dbg {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    white-space: nowrap;
  }
</style>
