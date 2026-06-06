<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy, untrack } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    setWidth,
    setInkFlow,
    setWobble,
    setWidthEnd,
    setWidthOffset,
    setWidthRange,
    setControlPoints,
    setHead,
    setWhisker,
    setWhiskerWidth,
    screenToWorld,
  } from "$lib/scenes/brush";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let width = $state(0.05);
  let inkFlow = $state(0.25);
  let wobble = $state(0.9);
  let showPoints = $state(true);
  let showHead = $state(true);
  let headSize = $state(0.15);
  let whiskerWidth = $state(0.015);
  let whiskerSegs = $state(5);
  let whiskerLen = $state(0.85);
  let whiskerDamping = $state(0.88);
  // anchor offset in head-local space (origin = eye/chain-tip, +x = forward).
  // mouth corners sit forward of the eye on the snout sides.
  const WHISKER_ANCHOR_X = 0.47;
  const WHISKER_ANCHOR_Y = 0.08;

  let widthPreset = $state('custom');
  let widthEnd = $state(0.1);
  // smoothstep width step: offset = where the width drops along the stroke
  // (0 head/tip .. 1 tail), range = how soft the drop is (small = abrupt, large = gradual).
  let widthOffset = $state(0.5);
  let widthRange = $state(1.0);

  const widthPresets = {
    uniform:    { end: 1.0,  offset: 0.5,  range: 1.0 },  // no taper (tail = head width)
    linear:     { end: 0.0,  offset: 0.5,  range: 1.0 },  // gentle full-length taper
    easeOut:    { end: 0.0,  offset: 0.75, range: 0.5 },  // stays thick, drops late
    easeIn:     { end: 0.0,  offset: 0.25, range: 0.5 },  // drops early, thin most
    custom:     null,
  };

  $effect(() => {
    if (widthPreset === "custom") return;
    const p = widthPresets[widthPreset];
    if (!p) return;
    widthEnd = p.end;
    widthOffset = p.offset;
    widthRange = p.range;
  });

  let vertexCount = $state(16);
  let chainLen = $state(1.2);
  let propagationSpeed = $state(0.6);
  let maxBendDeg = $state(60);     // max bend angle per joint (degrees)

  let points = $state([]);          // [{x,y}] in world coords
  let linkLen = $derived(vertexCount >= 2 ? chainLen / (vertexCount - 1) : 0);
  let canvasSize = $state({ w: 1, h: 1 });

  let tipTarget = null;
  let dragging = $state(false);

  $effect(() => { if (ready) setWidth(width); });
  $effect(() => { if (ready) setInkFlow(inkFlow); });
  $effect(() => { if (ready) setWobble(wobble); });
  $effect(() => { if (ready) setWidthEnd(widthEnd); });
  $effect(() => { if (ready) setWidthOffset(widthOffset); });
  $effect(() => { if (ready) setWidthRange(widthRange); });
  $effect(() => {
    if (ready && points.length >= 2) setControlPoints(points);
  });
  $effect(() => {
    if (ready) setHead(null, null, headSize, showHead);
  });
  $effect(() => {
    if (ready) setWhiskerWidth(whiskerWidth);
  });
  // rebuild whiskers when segment count changes only
  $effect(() => {
    whiskerSegs;
    untrack(() => resetWhiskers());
  });

  // rebuild baseline curve when vertex count or chain length change
  $effect(() => {
    resetBaseline();
  });

  // whiskers: two independent chains with verlet physics.
  // Each: array of { x, y, px, py }. index 0 = anchor (mouth corner, pinned),
  // last index = free tip. Reset rebuilds them in head-local frame.
  let whiskerL = [];
  let whiskerR = [];
  // reactive snapshot for the SVG overlay (plain arrays for cheap re-render)
  let whiskerView = $state({ L: [], R: [] });

  function headFrame() {
    const N = points.length;
    if (N < 2) {
      return { pos: { x: 0, y: 0 }, dir: { x: 1, y: 0 }, perp: { x: 0, y: 1 } };
    }
    const tip = points[N - 1];
    const prev = points[N - 2];
    let dx = tip.x - prev.x;
    let dy = tip.y - prev.y;
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) { dx = 1; dy = 0; }
    else { dx /= m; dy /= m; }
    return { pos: { x: tip.x, y: tip.y }, dir: { x: dx, y: dy }, perp: { x: -dy, y: dx } };
  }

  function whiskerAnchor(side) {
    // side: +1 = left (along +perp), -1 = right
    const f = headFrame();
    const ax = f.pos.x + f.dir.x * (WHISKER_ANCHOR_X * headSize) + f.perp.x * (side * WHISKER_ANCHOR_Y * headSize);
    const ay = f.pos.y + f.dir.y * (WHISKER_ANCHOR_X * headSize) + f.perp.y * (side * WHISKER_ANCHOR_Y * headSize);
    return { x: ax, y: ay, dir: f.dir, perp: f.perp };
  }

  function makeWhisker(side) {
    const N = Math.max(2, Math.floor(whiskerSegs));
    const a = whiskerAnchor(side);
    // initial layout: chain extending backwards (-dir) from anchor so it visually trails behind
    const total = whiskerLen * headSize;
    const step = total / (N - 1);
    const pts = [];
    for (let i = 0; i < N; i++) {
      const t = i * step;
      const x = a.x - a.dir.x * t + a.perp.x * (side * 0.02 * headSize * i);
      const y = a.y - a.dir.y * t + a.perp.y * (side * 0.02 * headSize * i);
      pts.push({ x, y, px: x, py: y });
    }
    return pts;
  }

  function resetWhiskers() {
    whiskerL = makeWhisker(+1);
    whiskerR = makeWhisker(-1);
  }

  function stepWhisker(chain, side) {
    const N = chain.length;
    if (N < 2) return;
    const a = whiskerAnchor(side);
    const segLen = (whiskerLen * headSize) / (N - 1);
    const damping = Math.max(0, Math.min(0.999, whiskerDamping));

    // verlet integration on all non-anchor points
    for (let i = 1; i < N; i++) {
      const p = chain[i];
      const vx = (p.x - p.px) * damping;
      const vy = (p.y - p.py) * damping;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy;
    }
    // pin anchor
    chain[0].x = a.x;
    chain[0].y = a.y;
    chain[0].px = a.x;
    chain[0].py = a.y;

    // distance + per-segment angle constraints, several iterations.
    //
    // Angle reference frames:
    //   seg 0 (anchor->chain[1]): clamped relative to HEAD direction with
    //     center = ROOT_FAN * side (whisker fans outward) and tolerance ROOT_TOL.
    //   seg k > 0: clamped relative to PARENT segment direction with center 0
    //     and tolerance linearly interpolated from ROOT_TOL (near root) to
    //     TIP_TOL (at last segment).
    const ITERS = 6;
    const ROOT_FAN = (145 * Math.PI) / 180;
    const ROOT_TOL = (5  * Math.PI) / 180;
    const TIP_TOL  = (45 * Math.PI) / 180;
    const lastSeg = N - 2;
    const hd = a.dir;

    for (let it = 0; it < ITERS; it++) {
      // distance pass
      for (let i = 1; i < N; i++) {
        const a0 = chain[i - 1];
        const b0 = chain[i];
        const dx = b0.x - a0.x;
        const dy = b0.y - a0.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1e-6) continue;
        const diff = (dist - segLen) / dist;
        if (i === 1) {
          b0.x -= dx * diff;
          b0.y -= dy * diff;
        } else {
          const half = diff * 0.5;
          a0.x += dx * half;
          a0.y += dy * half;
          b0.x -= dx * half;
          b0.y -= dy * half;
        }
      }
      // angle pass per segment. Move only chain[k+1].
      for (let k = 0; k <= lastSeg; k++) {
        const bx = chain[k + 1].x - chain[k].x;
        const by = chain[k + 1].y - chain[k].y;
        const bLen = Math.hypot(bx, by);
        if (bLen < 1e-6) continue;

        let pdx, pdy, center, tol;
        if (k === 0) {
          pdx = hd.x; pdy = hd.y;
          center = ROOT_FAN * side;
          tol = ROOT_TOL;
        } else {
          const ax = chain[k].x - chain[k - 1].x;
          const ay = chain[k].y - chain[k - 1].y;
          const aLen = Math.hypot(ax, ay);
          if (aLen < 1e-6) continue;
          pdx = ax / aLen; pdy = ay / aLen;
          center = 0;
          const t = lastSeg > 1 ? (k - 1) / (lastSeg - 1) : 1.0;
          tol = ROOT_TOL + (TIP_TOL - ROOT_TOL) * t;
        }
        const bdx = bx / bLen, bdy = by / bLen;
        const cross = pdx * bdy - pdy * bdx;
        const dot   = pdx * bdx + pdy * bdy;
        const ang   = Math.atan2(cross, dot);
        let target = ang;
        if (ang > center + tol) target = center + tol;
        else if (ang < center - tol) target = center - tol;
        if (target !== ang) {
          const c = Math.cos(target), s = Math.sin(target);
          const ndx = pdx * c - pdy * s;
          const ndy = pdx * s + pdy * c;
          chain[k + 1].x = chain[k].x + ndx * bLen;
          chain[k + 1].y = chain[k].y + ndy * bLen;
        }
      }
    }
  }

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

  function updateHead() {
    if (points.length < 2) return;
    const f = headFrame();
    setHead(f.pos, f.dir);
  }

  function pushWhiskers() {
    if (whiskerL.length >= 2) setWhisker(0, whiskerL);
    if (whiskerR.length >= 2) setWhisker(1, whiskerR);
    if (showPoints) {
      whiskerView = {
        L: whiskerL.map(p => ({ x: p.x, y: p.y })),
        R: whiskerR.map(p => ({ x: p.x, y: p.y })),
      };
    }
  }

  function loop() {
    frameID = requestAnimationFrame(loop);
    stepPhysics();
    stepWhisker(whiskerL, +1);
    stepWhisker(whiskerR, -1);
    updateHead();
    pushWhiskers();
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
    resetWhiskers();
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
        {#each [whiskerView.L, whiskerView.R] as chain}
          {#if chain.length >= 2}
            <polyline
              class="whisker"
              points={chain.map(p => { const s = worldToScreen(p); return `${s.x},${s.y}`; }).join(" ")}
            />
            {#each chain as p, i}
              {@const s = worldToScreen(p)}
              <circle
                cx={s.x} cy={s.y} r={i === 0 ? 5 : 3}
                class={i === 0 ? "whisker-anchor" : i === chain.length - 1 ? "whisker-tip" : "whisker-mid"}
              />
            {/each}
          {/if}
        {/each}
      </svg>
    {/if}
  </div>

  <div class="controls">
    <label>
      <span>width</span>
      <input type="range" min="0.01" max="0.4" step="0.001" bind:value={width} />
      <output>{width.toFixed(3)}</output>
    </label>
    <label>
      <span>ink flow</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={inkFlow} />
      <output>{inkFlow.toFixed(2)}</output>
    </label>
    <label>
      <span>wobble</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
      <output>{wobble.toFixed(2)}</output>
    </label>
    <hr />
    <label>
      <span>width shape</span>
      <select bind:value={widthPreset}>
        <option value="uniform">Uniform</option>
        <option value="linear">Linear</option>
        <option value="easeOut">Ease-out</option>
        <option value="easeIn">Ease-in</option>
        <option value="custom">Custom</option>
      </select>
      <output></output>
    </label>
    <label>
      <span>tail width</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthEnd}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthEnd.toFixed(2)}</output>
    </label>
    <label>
      <span>step offset</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthOffset}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthOffset.toFixed(2)}</output>
    </label>
    <label>
      <span>step range</span>
      <input
        type="range" min="0" max="1.5" step="0.01"
        bind:value={widthRange}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthRange.toFixed(2)}</output>
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
    <label>
      <span>dragon size</span>
      <input type="range" min="0" max="0.8" step="0.01" bind:value={headSize} />
      <output>{headSize.toFixed(2)}</output>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={showHead} />
      <span>show dragon head</span>
    </label>
    <label>
      <span>whisker width</span>
      <input type="range" min="0" max="0.05" step="0.001" bind:value={whiskerWidth} />
      <output>{whiskerWidth.toFixed(3)}</output>
    </label>
    <label>
      <span>whisker length</span>
      <input type="range" min="0.1" max="1.2" step="0.01" bind:value={whiskerLen} />
      <output>{whiskerLen.toFixed(2)}</output>
    </label>
    <label>
      <span>whisker segs</span>
      <input type="range" min="2" max="10" step="1" bind:value={whiskerSegs} />
      <output>{whiskerSegs}</output>
    </label>
    <label>
      <span>whisker damp</span>
      <input type="range" min="0.5" max="0.99" step="0.01" bind:value={whiskerDamping} />
      <output>{whiskerDamping.toFixed(2)}</output>
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
  @media(min-width: 768px) {
    .brush-demo {
      flex-direction: row;
    }
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
  .overlay circle.whisker-mid    { fill: rgba(200, 120, 50, 0.85); }
  .overlay circle.whisker-anchor { fill: rgba(255, 180, 60, 0.95); }
  .overlay circle.whisker-tip    { fill: rgba(160, 80, 200, 0.95); }
  .overlay polyline.whisker {
    stroke: rgba(200, 120, 50, 0.55);
    stroke-dasharray: 2 3;
  }
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
