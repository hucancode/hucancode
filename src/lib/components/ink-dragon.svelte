<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    setWidth,
    setInkFlow,
    setStrands,
    setWaterFlow,
    setWobble,
    setWidthEnd,
    setWidthOffset,
    setWidthRange,
    setWireframe,
    setHead,
    setWhiskerWidth,
    setPhysicsParam,
    setTipTarget,
    resetBaseline,
    resetWhiskers,
    step,
    getOverlay,
    eventToWorld,
    worldToScreen,
  } from "$lib/scenes/ink-dragon";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let width = $state(0.05);
  let inkFlow = $state(1.0);
  let strands = $state(3.0);
  let waterFlow = $state(0.8);
  let wobble = $state(0.9);
  let showPoints = $state(true);
  let showHead = $state(true);
  let showPath = $state(false);
  let wireframe = $state(false);
  let headSize = $state(0.15);
  let whiskerWidth = $state(0.01);
  let whiskerSegs = $state(5);
  let whiskerLen = $state(1.2);
  let whiskerDamping = $state(0.88);

  let widthPreset = $state('custom');
  let widthEnd = $state(0.1);
  let widthOffset = $state(0.2);
  let widthRange = $state(0.6);

  const widthPresets = {
    uniform:    { end: 1.0,  offset: 0.5,  range: 1.0 },
    linear:     { end: 0.0,  offset: 0.5,  range: 1.0 },
    easeOut:    { end: 0.0,  offset: 0.75, range: 0.5 },
    easeIn:     { end: 0.0,  offset: 0.25, range: 0.5 },
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
  let bodyLen = $state(1.2);
  let propagationSpeed = $state(0.6);
  let maxBendDeg = $state(60);

  let canvasSize = $state({ w: 1, h: 1 });
  let overlayView = $state({ body: [], whiskerL: [], whiskerR: [] });
  let pathView = $state({ samples: [], ctrls: [], cursor: null });

  // auto-fly — uniform cubic B-spline, C2 across all junctions
  let autoFly = $state(false);
  let autoSpeed = $state(0.6);
  let autoCtrl = null;   // rolling array of control points
  let autoU = 0;         // param within current segment [0,1)
  let autoTip = { x: 0, y: 0 };
  let autoLastTime = 0;

  // shader params
  $effect(() => { if (ready) setWidth(width); });
  $effect(() => { if (ready) setInkFlow(inkFlow); });
  $effect(() => { if (ready) setStrands(strands); });
  $effect(() => { if (ready) setWaterFlow(waterFlow); });
  $effect(() => { if (ready) setWobble(wobble); });
  $effect(() => { if (ready) setWidthEnd(widthEnd); });
  $effect(() => { if (ready) setWidthOffset(widthOffset); });
  $effect(() => { if (ready) setWidthRange(widthRange); });
  $effect(() => { if (ready) setWireframe(wireframe); });
  $effect(() => { if (ready) setHead(null, null, headSize, showHead); });
  $effect(() => { if (ready) setWhiskerWidth(whiskerWidth); });

  // physics params
  $effect(() => { if (ready) setPhysicsParam("vertexCount", vertexCount); });
  $effect(() => { if (ready) setPhysicsParam("bodyLen", bodyLen); });
  $effect(() => { if (ready) setPhysicsParam("propagationSpeed", propagationSpeed); });
  $effect(() => { if (ready) setPhysicsParam("maxBendDeg", maxBendDeg); });
  $effect(() => { if (ready) setPhysicsParam("whiskerSegs", whiskerSegs); });
  $effect(() => { if (ready) setPhysicsParam("whiskerLen", whiskerLen); });
  $effect(() => { if (ready) setPhysicsParam("whiskerDamping", whiskerDamping); });
  $effect(() => { if (ready) setPhysicsParam("headSize", headSize); });

  let dragging = false;

  function headFrameFromBody(body) {
    const n = body.length;
    if (n < 2) return { pos: { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
    const tip = body[n - 1];
    const prev = body[n - 2];
    let dx = tip.x - prev.x, dy = tip.y - prev.y;
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) return { pos: tip, dir: { x: 1, y: 0 } };
    return { pos: tip, dir: { x: dx / m, y: dy / m } };
  }

  // Uniform cubic B-spline: P(u) over 4 control pts, u in [0,1].
  function bsplinePos(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    const b0 = (-u3 + 3*u2 - 3*u + 1) / 6;
    const b1 = ( 3*u3 - 6*u2       + 4) / 6;
    const b2 = (-3*u3 + 3*u2 + 3*u + 1) / 6;
    const b3 =   u3 / 6;
    return {
      x: b0*p0.x + b1*p1.x + b2*p2.x + b3*p3.x,
      y: b0*p0.y + b1*p1.y + b2*p2.y + b3*p3.y,
    };
  }

  // dP/du — needed for arc-speed parameterization.
  function bsplineVel(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const d0 = (-3*u2 + 6*u - 3) / 6;
    const d1 = ( 9*u2 - 12*u   ) / 6;
    const d2 = (-9*u2 + 6*u + 3) / 6;
    const d3 =   3*u2 / 6;
    return {
      x: d0*p0.x + d1*p1.x + d2*p2.x + d3*p3.x,
      y: d0*p0.y + d1*p1.y + d2*p2.y + d3*p3.y,
    };
  }

  function pickNextCtrl(last, prev, aspect) {
    const pad = 0.1;
    const xMax = Math.max(0.1, aspect - pad);
    const yMax = 1 - pad;
    let fx = last.x - prev.x, fy = last.y - prev.y;
    const m = Math.hypot(fx, fy);
    if (m < 1e-6) { fx = 1; fy = 0; } else { fx /= m; fy /= m; }
    // bias forward, ±60° turn, viewport-clamped step
    for (let i = 0; i < 24; i++) {
      const ang = (Math.random() * 2 - 1) * (Math.PI / 3);
      const c = Math.cos(ang), s = Math.sin(ang);
      const nx = fx * c - fy * s;
      const ny = fx * s + fy * c;
      const step = 0.4 + Math.random() * 0.6;
      const x = last.x + nx * step;
      const y = last.y + ny * step;
      if (x < -xMax || x > xMax || y < -yMax || y > yMax) continue;
      return { x, y };
    }
    // fallback: reflect forward off bounds
    let x = last.x + fx * 0.4, y = last.y + fy * 0.4;
    x = Math.max(-xMax, Math.min(xMax, x));
    y = Math.max(-yMax, Math.min(yMax, y));
    return { x, y };
  }

  function seedAutoCtrl(pos, dir, aspect) {
    // 4 collinear seed pts → first segment starts at pos, moves along dir.
    // B-spline of 4 collinear ctrls = line, smoothly bends as new ctrls join.
    const s = 0.4;
    autoCtrl = [
      { x: pos.x - dir.x * s * 2, y: pos.y - dir.y * s * 2 },
      { x: pos.x - dir.x * s,     y: pos.y - dir.y * s     },
      { x: pos.x,                 y: pos.y                 },
      { x: pos.x + dir.x * s,     y: pos.y + dir.y * s     },
    ];
    // append a few more so first sample lies inside a real segment
    for (let i = 0; i < 2; i++) {
      const n = autoCtrl.length;
      autoCtrl.push(pickNextCtrl(autoCtrl[n - 1], autoCtrl[n - 2], aspect));
    }
    autoU = 0;
  }

  function stepAuto(dt) {
    const aspect = Math.max(canvasSize.w / canvasSize.h, 0.1);
    if (!autoCtrl) {
      const body = getOverlay().body;
      const f = headFrameFromBody(body);
      seedAutoCtrl(f.pos, f.dir, aspect);
      autoTip = { x: f.pos.x, y: f.pos.y };
    }
    let remaining = autoSpeed * dt;
    // arc-speed walk: advance u by remaining / |dP/du|, refilling ctrls as needed.
    for (let guard = 0; guard < 8 && remaining > 1e-6; guard++) {
      const p0 = autoCtrl[0], p1 = autoCtrl[1], p2 = autoCtrl[2], p3 = autoCtrl[3];
      const v = bsplineVel(p0, p1, p2, p3, autoU);
      const sp = Math.hypot(v.x, v.y);
      const du = remaining / Math.max(sp, 1e-3);
      if (autoU + du < 1) {
        autoU += du;
        remaining = 0;
      } else {
        const consumed = (1 - autoU) * Math.max(sp, 1e-3);
        remaining -= consumed;
        autoU = 0;
        autoCtrl.shift();
        const n = autoCtrl.length;
        autoCtrl.push(pickNextCtrl(autoCtrl[n - 1], autoCtrl[n - 2], aspect));
      }
    }
    const p0 = autoCtrl[0], p1 = autoCtrl[1], p2 = autoCtrl[2], p3 = autoCtrl[3];
    autoTip = bsplinePos(p0, p1, p2, p3, autoU);
    setTipTarget(autoTip);
  }

  $effect(() => {
    if (!ready) return;
    if (autoFly) {
      autoCtrl = null;
      autoLastTime = 0;
    } else {
      autoCtrl = null;
      autoLastTime = 0;
      if (!dragging) setTipTarget(null);
    }
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    if (autoFly) {
      const now = performance.now();
      const dt = autoLastTime ? Math.min(0.05, (now - autoLastTime) / 1000) : 0.016;
      autoLastTime = now;
      stepAuto(dt);
    }
    step();
    render();
    if (showPoints) overlayView = getOverlay();
    if (showPath && autoFly && autoCtrl && autoCtrl.length >= 4) {
      const samples = [];
      const SEGS_PER = 24;
      // sample each interior B-spline segment (window of 4 ctrls slides one each step)
      for (let i = 0; i + 3 < autoCtrl.length; i++) {
        const p0 = autoCtrl[i], p1 = autoCtrl[i+1], p2 = autoCtrl[i+2], p3 = autoCtrl[i+3];
        const start = i === 0 ? 0 : 1; // skip duplicate junction
        for (let k = start; k <= SEGS_PER; k++) {
          samples.push(bsplinePos(p0, p1, p2, p3, k / SEGS_PER));
        }
      }
      pathView = {
        samples,
        ctrls: autoCtrl.slice(),
        cursor: { x: autoTip.x, y: autoTip.y },
      };
    } else if (showPath) {
      pathView = { samples: [], ctrls: [], cursor: null };
    }
  }

  function onResize() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    resize(w, h);
    canvasSize = { w, h };
  }

  function onPointerDown(e) {
    if (autoFly) return;
    dragging = true;
    setTipTarget(eventToWorld(canvasEl, e));
    canvasEl.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    setTipTarget(eventToWorld(canvasEl, e));
  }
  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    setTipTarget(null);
    try { canvasEl.releasePointerCapture(e.pointerId); } catch {}
  }

  function ws(p) {
    return worldToScreen(p, canvasSize.w, canvasSize.h);
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
    {#if showPath && pathView.samples.length > 1}
      <svg
        class="overlay path-overlay"
        viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
        preserveAspectRatio="none"
      >
        <polyline
          class="path-curve"
          points={pathView.samples.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
        />
        {#if pathView.ctrls.length >= 2}
          <polyline
            class="path-ctrl-poly"
            points={pathView.ctrls.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
          />
        {/if}
        {#each pathView.ctrls as p}
          {@const s = ws(p)}
          <circle class="path-ctrl" cx={s.x} cy={s.y} r="4" />
        {/each}
        {#if pathView.cursor}
          {@const s = ws(pathView.cursor)}
          <circle class="path-cursor" cx={s.x} cy={s.y} r="6" />
        {/if}
      </svg>
    {/if}
    {#if showPoints && overlayView.body.length > 0}
      <svg
        class="overlay"
        viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
        preserveAspectRatio="none"
      >
        <polyline
          points={overlayView.body.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
        />
        {#each overlayView.body as p, i}
          {@const s = ws(p)}
          <circle
            cx={s.x} cy={s.y} r={i === overlayView.body.length - 1 ? 6 : 4}
            class={i === 0 ? "first" : i === overlayView.body.length - 1 ? "last" : "mid"}
          />
        {/each}
        {#each [overlayView.whiskerL, overlayView.whiskerR] as chain}
          {#if chain.length >= 2}
            <polyline
              class="whisker"
              points={chain.map(p => { const s = ws(p); return `${s.x},${s.y}`; }).join(" ")}
            />
            {#each chain as p, i}
              {@const s = ws(p)}
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
    <fieldset>
      <legend>brush</legend>
      <label>
        <span>width</span>
        <input type="range" min="0.01" max="0.4" step="0.001" bind:value={width} />
        <output>{width.toFixed(3)}</output>
      </label>
      <label>
        <span>ink flow</span>
        <input type="range" min="0.2" max="3" step="0.01" bind:value={inkFlow} />
        <output>{inkFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>water flow</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={waterFlow} />
        <output>{waterFlow.toFixed(2)}</output>
      </label>
      <label>
        <span>strands</span>
        <input type="range" min="0.1" max="4" step="0.01" bind:value={strands} />
        <output>{strands.toFixed(2)}</output>
      </label>
      <label>
        <span>wobble</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
        <output>{wobble.toFixed(2)}</output>
      </label>
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
    </fieldset>

    <fieldset>
      <legend>Body</legend>
      <label>
        <span>vertex count</span>
        <input type="range" min="2" max="40" step="1" bind:value={vertexCount} />
        <output>{vertexCount}</output>
      </label>
      <label>
        <span>length</span>
        <input type="range" min="0.1" max="2.5" step="0.01" bind:value={bodyLen} />
        <output>{bodyLen.toFixed(2)}</output>
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
      <div class="buttons">
        <button type="button" onclick={() => resetBaseline()}>reset chain</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>head</legend>
      <label class="check">
        <input type="checkbox" bind:checked={showHead} />
        <span>show</span>
      </label>
      <label>
        <span>dragon size</span>
        <input type="range" min="0" max="0.8" step="0.01" bind:value={headSize} />
        <output>{headSize.toFixed(2)}</output>
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
    </fieldset>

    <fieldset>
      <legend>auto fly</legend>
      <label class="check">
        <input type="checkbox" bind:checked={autoFly} />
        <span>enable</span>
      </label>
      <label>
        <span>speed</span>
        <input type="range" min="0.05" max="2" step="0.01" bind:value={autoSpeed} />
        <output>{autoSpeed.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset>
      <legend>debug</legend>
      <label class="check">
        <input type="checkbox" bind:checked={showPoints} />
        <span>show control points</span>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={showPath} />
        <span>show auto-fly path</span>
      </label>
      <label class="check">
        <input type="checkbox" bind:checked={wireframe} />
        <span>wireframe body</span>
      </label>
      <p class="hint">drag on canvas: tip follows mouse, chain pulls along when stretched</p>
    </fieldset>
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
    aspect-ratio: 16 / 9;
  }
  @media(min-width: 768px) {
    .brush-demo .stage { flex: 1 1 auto; }
    .controls { flex: 0 0 18rem; }
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
  .path-overlay polyline.path-curve {
    fill: none;
    stroke: rgba(80, 160, 255, 0.85);
    stroke-width: 2;
    stroke-dasharray: none;
  }
  .path-overlay polyline.path-ctrl-poly {
    fill: none;
    stroke: rgba(80, 160, 255, 0.35);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }
  .path-overlay circle.path-ctrl {
    fill: rgba(80, 160, 255, 0.9);
    stroke: white;
    stroke-width: 1.5;
  }
  .path-overlay circle.path-cursor {
    fill: rgba(255, 220, 60, 0.95);
    stroke: rgba(40, 40, 40, 0.9);
    stroke-width: 1.5;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
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
