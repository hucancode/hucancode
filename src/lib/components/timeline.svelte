<script>
  import { onMount, onDestroy } from "svelte";
  import rough from "roughjs";

  let { progress = 0, onseek = null } = $props();

  let host, canvasEl, ro, rc;
  let dragging = false;

  function draw() {
    if (!rc || !host || !canvasEl) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    canvasEl.style.width = w + "px";
    canvasEl.style.height = h + "px";
    const ctx = canvasEl.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const y = h / 2;
    const x0 = 2, x1 = w - 2;
    const p = Math.min(1, Math.max(0, progress));
    const px = x0 + (x1 - x0) * p;
    // unplayed baseline, lowkey
    rc.line(px, y, x1, y, { stroke: "#6b6450", strokeWidth: 2, roughness: 1.0, bowing: 0, seed: 7 });
    // played portion, sketchy + bolder
    if (px > x0) {
      rc.line(x0, y, px, y, { stroke: "#c1666b", strokeWidth: 4.5, roughness: 1.4, bowing: 1, seed: 13 });
    }
    // hand-drawn handle circle at playhead
    rc.circle(px, y, 14, { stroke: "#d4b483", strokeWidth: 2, fill: "#c1666b", fillStyle: "solid", roughness: 1.2, seed: 21 });
  }

  function seekAt(clientX) {
    const r = host.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onseek && onseek(p);
  }
  function onDown(e) { dragging = true; host.setPointerCapture?.(e.pointerId); seekAt(e.clientX); }
  function onMove(e) { if (dragging) seekAt(e.clientX); }
  function onUp() { dragging = false; }

  onMount(() => {
    rc = rough.canvas(canvasEl);
    draw();
    ro = new ResizeObserver(() => draw());
    ro.observe(host);
  });
  onDestroy(() => ro && ro.disconnect());

  // redraw when progress changes
  $effect(() => {
    progress;
    draw();
  });
</script>

<div
  class="rt"
  bind:this={host}
  role="slider"
  aria-label="scene timeline"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(progress * 100)}
  tabindex="0"
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={onUp}
  onpointerleave={onUp}
>
  <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
</div>

<style>
  .rt {
    position: relative;
    flex: 1;
    height: 20px;
    min-width: 80px;
    cursor: pointer;
    touch-action: none;
  }
  .rt canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
