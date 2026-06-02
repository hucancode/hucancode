<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    setOffset,
    setArcLength,
    setWidth,
    setTaper,
    setInkFlow,
    setControlPoints,
    screenToWorld,
  } from "$lib/scenes/brush";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let offset = $state(0);
  let arcLength = $state(1);
  let width = $state(0.05);
  let taper = $state(4);
  let inkFlow = $state(0.25);
  let showPoints = $state(true);

  let vertexCount = $state(10);
  let chainLen = $state(1.0);
  let propagationSpeed = $state(0.4);
  let maxBendDeg = $state(60);     // max bend angle per joint (degrees)

  let points = $state([]);          // [{x,y}] in world coords
  let linkLen = $derived(vertexCount >= 2 ? chainLen / (vertexCount - 1) : 0);
  let canvasSize = $state({ w: 1, h: 1 });

  let tipTarget = null;
  let dragging = $state(false);

  $effect(() => { if (ready) setOffset(offset); });
  $effect(() => { if (ready) setArcLength(arcLength); });
  $effect(() => { if (ready) setWidth(width); });
  $effect(() => { if (ready) setTaper(taper); });
  $effect(() => { if (ready) setInkFlow(inkFlow); });
  $effect(() => {
    if (ready && points.length >= 2) setControlPoints(points);
  });

  // rebuild baseline curve when vertex count or chain length change
  $effect(() => {
    resetBaseline();
  });

  function resetBaseline() {
    const N = Math.max(2, Math.floor(vertexCount));
    const L = chainLen;
    const pts = [];
    // horizontal chain centered at origin, total length = chainLen
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      pts.push({ x: -L / 2 + t * L, y: 0 });
    }
    points = pts;
  }

  function stepPhysics() {
    if (!tipTarget || points.length < 2) return;
    const N = points.length;
    const next = points.slice();
    const speed = Math.max(0, Math.min(1, propagationSpeed));

    // tip always pinned to mouse target (instant)
    next[N - 1] = { x: tipTarget.x, y: tipTarget.y };

    // distance constraint pass 1: pull each link toward its neighbor by speed * excess.
    // speed=0 means link never moves; speed=1 means link snaps to satisfy distance.
    for (let i = N - 2; i >= 0; i--) {
      const dx = next[i + 1].x - next[i].x;
      const dy = next[i + 1].y - next[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const pull = (d - linkLen) * speed;
        const inv = pull / d;
        next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
      }
    }

    // angle constraint: rotate head toward target angle by speed (partial slerp).
    const maxBend = (maxBendDeg * Math.PI) / 180;
    if (maxBend < Math.PI - 1e-3 && N >= 3) {
      const minCosForClamp = -Math.cos(maxBend);
      for (let i = N - 2; i >= 1; i--) {
        const tip = next[i + 1];
        const mid = next[i];
        const head = next[i - 1];
        const ax = tip.x - mid.x, ay = tip.y - mid.y;
        const bx = head.x - mid.x, by = head.y - mid.y;
        const aLen = Math.hypot(ax, ay);
        const bLen = Math.hypot(bx, by);
        if (aLen < 1e-6 || bLen < 1e-6) continue;
        const adx = ax / aLen, ady = ay / aLen;
        const bdx = bx / bLen, bdy = by / bLen;
        const cosAng = adx * bdx + ady * bdy;
        if (cosAng > minCosForClamp) {
          // current angle from a->b
          const curAng = Math.atan2(adx * bdy - ady * bdx, adx * bdx + ady * bdy);
          const side = curAng >= 0 ? 1 : -1;
          const targetAng = (Math.PI - maxBend) * side;
          // partial rotation by speed
          const newAng = curAng + (targetAng - curAng) * speed;
          const c = Math.cos(newAng), s = Math.sin(newAng);
          const newBdx = adx * c - ady * s;
          const newBdy = adx * s + ady * c;
          next[i - 1] = { x: mid.x + newBdx * bLen, y: mid.y + newBdy * bLen };
        }
      }

      // distance pass 2: same scaled clamp to restore link lengths
      for (let i = N - 2; i >= 0; i--) {
        const dx = next[i + 1].x - next[i].x;
        const dy = next[i + 1].y - next[i].y;
        const d = Math.hypot(dx, dy);
        if (d > linkLen && d > 1e-6) {
          const pull = (d - linkLen) * speed;
          const inv = pull / d;
          next[i] = { x: next[i].x + dx * inv, y: next[i].y + dy * inv };
        }
      }
    }

    points = next;
  }

  function loop() {
    frameID = requestAnimationFrame(loop);
    stepPhysics();
    render();
  }

  function onResize() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    resize(w, h);
    canvasSize = { w, h };
  }

  function pointerPos(e) {
    const r = canvasEl.getBoundingClientRect();
    return screenToWorld(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
  }

  function onPointerDown(e) {
    dragging = true;
    tipTarget = pointerPos(e);
    canvasEl.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    tipTarget = pointerPos(e);
  }
  function onPointerUp(e) {
    dragging = false;
    tipTarget = null;
    try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
  }

  // world->screen for overlay
  function worldToScreen(p) {
    const { w, h } = canvasSize;
    const aspect = w / h;
    const u = (p.x / aspect + 1) * 0.5;
    const v = (p.y + 1) * 0.5;
    return { x: u * w, y: (1 - v) * h };
  }

  onMount(() => {
    init(canvasEl);
    resetBaseline();
    ready = true;
    onResize();
    window.addEventListener("resize", onResize);
    observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        frameID = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frameID);
      }
    });
    observer.observe(canvasEl);
  });

  onDestroy(() => {
    if (!browser) return;
    cancelAnimationFrame(frameID);
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
    destroy();
  });
</script>

<div class="brush-demo">
  <div class="stage">
    <canvas
      bind:this={canvasEl}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
    ></canvas>
    {#if showPoints && points.length > 0}
      <svg
        class="overlay"
        viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={points.map(p => { const s = worldToScreen(p); return `${s.x},${s.y}`; }).join(" ")}
        />
        {#each points as p, i}
          {@const s = worldToScreen(p)}
          <circle
            cx={s.x} cy={s.y} r={i === points.length - 1 ? 6 : 4}
            class={i === 0 ? "first" : i === points.length - 1 ? "last" : "mid"}
          />
        {/each}
      </svg>
    {/if}
  </div>

  <div class="controls">
    <label>
      <span>offset</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={offset} />
      <output>{offset.toFixed(2)}</output>
    </label>
    <label>
      <span>arc length</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={arcLength} />
      <output>{arcLength.toFixed(2)}</output>
    </label>
    <label>
      <span>width</span>
      <input type="range" min="0.01" max="0.4" step="0.001" bind:value={width} />
      <output>{width.toFixed(3)}</output>
    </label>
    <label>
      <span>taper</span>
      <input type="range" min="1" max="16" step="0.1" bind:value={taper} />
      <output>{taper.toFixed(1)}</output>
    </label>
    <label>
      <span>ink flow</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={inkFlow} />
      <output>{inkFlow.toFixed(2)}</output>
    </label>
    <hr />
    <label>
      <span>vertex count</span>
      <input type="range" min="2" max="40" step="1" bind:value={vertexCount} />
      <output>{vertexCount}</output>
    </label>
    <label>
      <span>chain length</span>
      <input type="range" min="0.1" max="2.5" step="0.01" bind:value={chainLen} />
      <output>{chainLen.toFixed(2)}</output>
    </label>
    <label>
      <span>prop. speed</span>
      <input type="range" min="0.01" max="1" step="0.01" bind:value={propagationSpeed} />
      <output>{propagationSpeed.toFixed(2)}</output>
    </label>
    <label>
      <span>max bend</span>
      <input type="range" min="0" max="180" step="1" bind:value={maxBendDeg} />
      <output>{maxBendDeg}&deg;</output>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={showPoints} />
      <span>show control points ({points.length}) — link len {linkLen.toFixed(3)}</span>
    </label>
    <div class="buttons">
      <button type="button" onclick={resetBaseline}>reset</button>
    </div>
    <p class="hint">drag on canvas: tip follows mouse, chain pulls along when stretched</p>
  </div>
</div>

<style>
  .brush-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
  }
  canvas {
    width: 100%;
    height: 100%;
    background: #fffce0;
    border-radius: 0.25rem;
    touch-action: none;
    cursor: grab;
    display: block;
  }
  canvas:active { cursor: grabbing; }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }
  .overlay circle {
    fill: rgba(220, 50, 50, 0.85);
    stroke: white;
    stroke-width: 1.5;
  }
  .overlay circle.first { fill: rgba(50, 180, 80, 0.95); }
  .overlay circle.last  { fill: rgba(50, 100, 220, 0.95); }
  .overlay polyline {
    fill: none;
    stroke: rgba(180, 60, 60, 0.45);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  hr {
    border: 0;
    border-top: 1px solid rgba(128,128,128,0.3);
    margin: 0.25rem 0;
  }
  label {
    display: grid;
    grid-template-columns: 6rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  label.check {
    grid-template-columns: auto 1fr;
  }
  input[type="range"] { width: 100%; }
  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.7;
  }
</style>
