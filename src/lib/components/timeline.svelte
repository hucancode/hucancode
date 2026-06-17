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
    // a single rough baseline spanning the bar, lowkey
    rc.line(2, y, w - 2, y, { stroke: "#6b6450", strokeWidth: 1, roughness: 1.0, bowing: 0 });
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
  <div class="fill" style:width={`${Math.min(1, Math.max(0, progress)) * 100}%`}></div>
  <canvas bind:this={canvasEl} aria-hidden="true"></canvas>
</div>

<style>
  .rt {
    position: relative;
    flex: 1;
    height: 12px;
    min-width: 80px;
    cursor: pointer;
    touch-action: none;
  }
  .rt .fill {
    position: absolute;
    top: 50%;
    left: 0;
    height: 4px;
    transform: translateY(-50%);
    border-radius: 2px;
    background: linear-gradient(90deg, #d4b483, #c1666b, #6b4e71);
    opacity: 0.8;
  }
  .rt canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
