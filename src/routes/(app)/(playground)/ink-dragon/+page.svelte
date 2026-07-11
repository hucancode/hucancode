<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    setParams,
    setHead,
    setPhysicsParam,
    setTipTarget,
    setView,
    resetBaseline,
    resetWhiskers,
    step,
    getOverlay,
    eventToWorld,
    worldToScreen,
  } from "$lib/playgrounds/ink-dragon";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let width = $state(0.05);
  let widthEnd = $state(0.1);
  let showPoints = $state(true);
  let showPath = $state(false);
  let headSize = $state(0.15);
  let whiskerWidth = $state(0.01);
  let whiskerSegs = $state(8);
  let whiskerLen = $state(1.8);
  let whiskerDamping = $state(0.88);

  let vertexCount = $state(16);
  let bodyLen = $state(1.2);
  let propagationSpeed = $state(0.6);
  let maxBendDeg = $state(60);

  let canvasSize = $state({ w: 1, h: 1 });
  let overlayView = $state({ body: [], whiskerL: [], whiskerR: [] });
  let pathView = $state({ circles: [], cursor: null });

  // camera: wheel = zoom at cursor; grabbing the dragon head drags the tip,
  // grabbing empty space pans (always pans while auto-fly drives the tip).
  let view = $state({ zoom: 1, panX: 0, panY: 0 });
  $effect(() => {
    if (ready) setView({ zoom: view.zoom, panX: view.panX, panY: view.panY });
  });
  function pageScreenToWorld(x, y, w, h) {
    const a = w / h;
    const vx = ((x / w) * 2 - 1) * a;
    const vy = (1 - y / h) * 2 - 1;
    return { x: vx / view.zoom + view.panX, y: vy / view.zoom + view.panY };
  }
  function onWheel(e) {
    if (!canvasEl) return;
    e.preventDefault();
    const r = canvasEl.getBoundingClientRect();
    const sx = e.clientX - r.left,
      sy = e.clientY - r.top;
    const before = pageScreenToWorld(sx, sy, r.width, r.height);
    view.zoom = Math.max(0.2, Math.min(20, view.zoom * Math.exp(-e.deltaY * 0.0015)));
    const after = pageScreenToWorld(sx, sy, r.width, r.height);
    view.panX += before.x - after.x;
    view.panY += before.y - after.y;
  }
  function resetView() {
    view.zoom = 1;
    view.panX = 0;
    view.panY = 0;
  }

  // auto-fly - rosette walk (as in the main playground): a frame of mutually
  // tangent circles (grand circle + vesica pair + medium ring); the tip rides
  // circular arcs and may branch onto the touching circle at each tangency
  // point. Alternating-tangent joins keep the path C1 everywhere.
  let autoFly = $state(false);
  let autoSpeed = $state(2.0);
  let rosette = null; // { circles, ci, ang, dir, swept }
  let autoTip = { x: 0, y: 0 };
  let autoLastTime = 0;

  // brush params
  $effect(() => {
    if (!ready) return;
    setParams({ width, widthEnd, whiskerWidth });
  });
  $effect(() => {
    if (ready) setHead(null, null, headSize);
  });

  // physics params
  $effect(() => {
    if (ready) setPhysicsParam("vertexCount", vertexCount);
  });
  $effect(() => {
    if (ready) setPhysicsParam("bodyLen", bodyLen);
  });
  $effect(() => {
    if (ready) setPhysicsParam("propagationSpeed", propagationSpeed);
  });
  $effect(() => {
    if (ready) setPhysicsParam("maxBendDeg", maxBendDeg);
  });
  $effect(() => {
    if (ready) setPhysicsParam("whiskerSegs", whiskerSegs);
  });
  $effect(() => {
    if (ready) setPhysicsParam("whiskerLen", whiskerLen);
  });
  $effect(() => {
    if (ready) setPhysicsParam("whiskerDamping", whiskerDamping);
  });
  $effect(() => {
    if (ready) setPhysicsParam("headSize", headSize);
  });

  let dragging = false;

  function headFrameFromBody(body) {
    const n = body.length;
    if (n < 2) return { pos: { x: 0, y: 0 }, dir: { x: 1, y: 0 } };
    const tip = body[n - 1];
    const prev = body[n - 2];
    let dx = tip.x - prev.x,
      dy = tip.y - prev.y;
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) return { pos: tip, dir: { x: 1, y: 0 } };
    return { pos: tip, dir: { x: dx / m, y: dy / m } };
  }

  const TAU = Math.PI * 2;
  const TAN_EPS = 1e-4; // tangency / coincident-point tolerance
  const BRANCH_P = 0.5; // chance to switch circles at a touching point
  const ROSETTE_R = 0.45; // grand-circle radius (world units)

  // frame of mutually tangent circles: grand circle + vesica pair (internally
  // tangent) + ring of 8 externally tangent circles. Every tangency wired on
  // BOTH circles as { a: angle here, j: partner index, aj: angle on partner }.
  function buildRosette() {
    const R = ROSETTE_R;
    const circles = [{ cx: 0, cy: 0, r: R }];
    const ir = 0.5 * R;
    const axis = Math.PI / 8; // vesica axis offset off the ring spokes
    for (const s of [1, -1]) {
      circles.push({ cx: s * ir * Math.cos(axis), cy: s * ir * Math.sin(axis), r: ir });
    }
    const N = 8;
    const s = Math.sin(Math.PI / N);
    const rmed = Math.min(0.7 * R, (R * s) / (1 - s)); // clamp: ring neighbours touch, never overlap
    for (let k = 0; k < N; k++) {
      const a = k * (TAU / N);
      circles.push({ cx: (R + rmed) * Math.cos(a), cy: (R + rmed) * Math.sin(a), r: rmed });
    }
    for (const c of circles) c.tan = [];
    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const a = circles[i], b = circles[j];
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const d = Math.hypot(dx, dy) || 1e-9;
        const ext = Math.abs(d - (a.r + b.r)) < TAN_EPS;
        const int = Math.abs(d - Math.abs(a.r - b.r)) < TAN_EPS;
        if (!ext && !int) continue;
        let px, py;
        if (ext) {
          px = a.cx + (dx / d) * a.r;
          py = a.cy + (dy / d) * a.r;
        } else {
          const aBig = a.r >= b.r;
          const big = aBig ? a : b, sgn = aBig ? 1 : -1;
          px = big.cx + ((sgn * dx) / d) * big.r;
          py = big.cy + ((sgn * dy) / d) * big.r;
        }
        const ai = Math.atan2(py - a.cy, px - a.cx);
        const aj = Math.atan2(py - b.cy, px - b.cx);
        a.tan.push({ a: ai, j, aj });
        b.tan.push({ a: aj, j: i, aj: ai });
      }
    }
    return circles;
  }

  const pointOn = (c, a) => ({ x: c.cx + c.r * Math.cos(a), y: c.cy + c.r * Math.sin(a) });

  // frame is deterministic - build once, shared by the walker and the debug overlay
  let frameCircles = null;
  const rosetteCircles = () => (frameCircles ??= buildRosette());

  // enter the grand circle at the angle nearest the current head, riding the
  // direction whose tangent best matches the current heading.
  function seedRosette() {
    const circles = rosetteCircles();
    const f = headFrameFromBody(getOverlay().body);
    const ang = Math.atan2(f.pos.y, f.pos.x);
    const dir = -Math.sin(ang) * f.dir.x + Math.cos(ang) * f.dir.y >= 0 ? 1 : -1;
    rosette = { circles, ci: 0, ang, dir, swept: 0 };
    autoTip = pointOn(circles[0], ang);
  }

  function stepAuto(dt) {
    if (!rosette) seedRosette();
    const rs = rosette;
    let remaining = autoSpeed * dt;
    for (let guard = 0; guard < 8 && remaining > 1e-6; guard++) {
      const c = rs.circles[rs.ci];
      // nearest tangency ahead in travel direction
      let best = null, bestSweep = Infinity;
      for (const tp of c.tan) {
        let sweep = (((rs.dir * (tp.a - rs.ang)) % TAU) + TAU) % TAU;
        if (sweep < TAN_EPS) sweep += TAU; // skip point we're sitting on
        if (sweep < bestSweep) { bestSweep = sweep; best = tp; }
      }
      const arcToTan = c.r * bestSweep;
      if (!best || remaining < arcToTan) {
        rs.ang += (rs.dir * remaining) / c.r;
        rs.swept += remaining / c.r;
        break;
      }
      remaining -= arcToTan;
      rs.swept += bestSweep;
      rs.ang = best.a;
      // commit to at least half a circle before peeling off (no quick in/out);
      // branch preserves the tangent -> derive partner's travel direction
      if (rs.swept >= Math.PI - TAN_EPS && Math.random() < BRANCH_P) {
        const tx = rs.dir * -Math.sin(rs.ang), ty = rs.dir * Math.cos(rs.ang);
        const ndir = tx * -Math.sin(best.aj) + ty * Math.cos(best.aj) >= 0 ? 1 : -1;
        rs.ci = best.j;
        rs.ang = best.aj;
        rs.dir = ndir;
        rs.swept = 0;
      }
    }
    autoTip = pointOn(rs.circles[rs.ci], rs.ang);
    setTipTarget(autoTip);
  }

  $effect(() => {
    if (!ready) return;
    rosette = null;
    autoLastTime = 0;
    if (!autoFly && !dragging) setTipTarget(null);
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    if (autoFly) {
      const now = performance.now();
      const dt = autoLastTime
        ? Math.min(0.05, (now - autoLastTime) / 1000)
        : 0.016;
      autoLastTime = now;
      stepAuto(dt);
    }
    step();
    render();
    if (showPoints) overlayView = getOverlay();
    if (showPath) {
      pathView = {
        circles: rosetteCircles().map((c) => ({ cx: c.cx, cy: c.cy, r: c.r })),
        cursor: autoFly && rosette ? { x: autoTip.x, y: autoTip.y } : null,
      };
    }
  }

  // canvas backing store + engine aspect are synced by the playground itself;
  // this only tracks the CSS size for the SVG debug overlays.
  function onResize() {
    if (!canvasEl) return;
    canvasSize = { w: canvasEl.clientWidth, h: canvasEl.clientHeight };
  }

  let panning = false;
  let panLast = null;
  function onPointerDown(e) {
    e.preventDefault();
    canvasEl.setPointerCapture(e.pointerId);
    const w = eventToWorld(canvasEl, e);
    const body = getOverlay().body;
    const tip = body[body.length - 1];
    // generous grab radius so the head is easy to catch
    const grabR = Math.max(0.25, headSize * 2.5);
    const onHead = tip && Math.hypot(w.x - tip.x, w.y - tip.y) <= grabR;
    if (!autoFly && onHead) {
      dragging = true;
      setTipTarget(w);
    } else {
      panning = true;
      panLast = { x: e.clientX, y: e.clientY };
    }
  }
  function onPointerMove(e) {
    if (panning) {
      const dx = e.clientX - panLast.x;
      const dy = e.clientY - panLast.y;
      panLast = { x: e.clientX, y: e.clientY };
      const aspect = canvasSize.w / Math.max(canvasSize.h, 1);
      view.panX -= ((dx / canvasSize.w) * 2 * aspect) / view.zoom;
      view.panY += ((dy / canvasSize.h) * 2) / view.zoom;
      return;
    }
    if (!dragging) return;
    setTipTarget(eventToWorld(canvasEl, e));
  }
  function onPointerUp(e) {
    if (panning) {
      panning = false;
      panLast = null;
      try {
        canvasEl.releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }
    if (!dragging) return;
    dragging = false;
    setTipTarget(null);
    try {
      canvasEl.releasePointerCapture(e.pointerId);
    } catch {}
  }

  function ws(p) {
    return worldToScreen(p, canvasSize.w, canvasSize.h);
  }

  let cancelled = false;
  onMount(() => {
    init(canvasEl).then(() => {
      if (cancelled) return;
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
    return () => { cancelled = true; };
  });

  onDestroy(() => {
    if (!browser) return;
    cancelAnimationFrame(frameID);
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
    destroy();
  });
</script>
<svelte:head>
  <title>Ink Dragon</title>
</svelte:head>


<section onwheel={onWheel}>
  <canvas
    bind:this={canvasEl}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
  ></canvas>
  <menu onpointerdown={(e) => e.stopPropagation()}>
    <li><output>{Math.round(view.zoom * 100)}%</output></li>
    <li><button type="button" title="reset view" onclick={resetView} aria-label="reset view">
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v4h4" />
      </svg>
    </button></li>
  </menu>
  {#if showPath && pathView.circles.length > 0}
    <svg
      viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
      preserveAspectRatio="none"
    >
      <!-- rosette frame: world radius -> px via half-height * zoom -->
      {#each pathView.circles as c}
        {@const s = ws({ x: c.cx, y: c.cy })}
        <circle
          fill="none"
          style="stroke: rgba(80, 160, 255, 0.55)"
          stroke-dasharray="4 4"
          cx={s.x}
          cy={s.y}
          r={(c.r * view.zoom * canvasSize.h) / 2}
        />
      {/each}
      {#if pathView.cursor}
        {@const s = ws(pathView.cursor)}
        <circle
          fill="rgba(255, 220, 60, 0.95)"
          style="stroke: rgba(40, 40, 40, 0.9)"
          cx={s.x}
          cy={s.y}
          r="6"
        />
      {/if}
    </svg>
  {/if}
  {#if showPoints && overlayView.body.length > 0}
    <svg
      viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
      preserveAspectRatio="none"
    >
      <polyline
        stroke="rgba(180, 60, 60, 0.45)"
        stroke-dasharray="4 4"
        points={overlayView.body
          .map((p) => {
            const s = ws(p);
            return `${s.x},${s.y}`;
          })
          .join(" ")}
      />
      {#each overlayView.body as p, i}
        {@const s = ws(p)}
        <circle
          cx={s.x}
          cy={s.y}
          r={i === overlayView.body.length - 1 ? 10 : 4}
          fill={i === 0
            ? "rgba(50, 180, 80, 0.95)"
            : i === overlayView.body.length - 1
              ? "rgba(50, 100, 220, 0.95)"
              : "rgba(220, 50, 50, 0.85)"}
        />
      {/each}
      {#each [overlayView.whiskerL, overlayView.whiskerR] as chain}
        {#if chain.length >= 2}
          <polyline
            stroke="rgba(200, 120, 50, 0.55)"
            stroke-dasharray="2 3"
            points={chain
              .map((p) => {
                const s = ws(p);
                return `${s.x},${s.y}`;
              })
              .join(" ")}
          />
          {#each chain as p, i}
            {@const s = ws(p)}
            <circle
              cx={s.x}
              cy={s.y}
              r={i === 0 ? 5 : 3}
              fill={i === 0
                ? "rgba(255, 180, 60, 0.95)"
                : i === chain.length - 1
                  ? "rgba(160, 80, 200, 0.95)"
                  : "rgba(200, 120, 50, 0.85)"}
            />
          {/each}
        {/if}
      {/each}
    </svg>
  {/if}
</section>

<aside>
  <fieldset>
    <legend>brush</legend>
    <label>
      <span>width</span>
      <input
        type="range"
        min="0.01"
        max="0.4"
        step="0.001"
        bind:value={width}
      />
      <output>{width.toFixed(3)}</output>
    </label>
    <label>
      <span>tail width</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={widthEnd} />
      <output>{widthEnd.toFixed(2)}</output>
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
      <input
        type="range"
        min="0.1"
        max="2.5"
        step="0.01"
        bind:value={bodyLen}
      />
      <output>{bodyLen.toFixed(2)}</output>
    </label>
    <label>
      <span>prop. speed</span>
      <input
        type="range"
        min="0.01"
        max="1"
        step="0.01"
        bind:value={propagationSpeed}
      />
      <output>{propagationSpeed.toFixed(2)}</output>
    </label>
    <label>
      <span>max bend</span>
      <input type="range" min="0" max="180" step="1" bind:value={maxBendDeg} />
      <output>{maxBendDeg}&deg;</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>head</legend>
    <label>
      <span>dragon size</span>
      <input type="range" min="0" max="0.8" step="0.01" bind:value={headSize} />
      <output>{headSize.toFixed(2)}</output>
    </label>
    <label>
      <span>whisker width</span>
      <input
        type="range"
        min="0"
        max="0.05"
        step="0.001"
        bind:value={whiskerWidth}
      />
      <output>{whiskerWidth.toFixed(3)}</output>
    </label>
    <label>
      <span>whisker length</span>
      <input
        type="range"
        min="0.1"
        max="1.2"
        step="0.01"
        bind:value={whiskerLen}
      />
      <output>{whiskerLen.toFixed(2)}</output>
    </label>
    <label>
      <span>whisker segs</span>
      <input type="range" min="2" max="10" step="1" bind:value={whiskerSegs} />
      <output>{whiskerSegs}</output>
    </label>
    <label>
      <span>whisker damp</span>
      <input
        type="range"
        min="0.5"
        max="0.99"
        step="0.01"
        bind:value={whiskerDamping}
      />
      <output>{whiskerDamping.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>auto fly</legend>
    <label>
      <input type="checkbox" bind:checked={autoFly} />
      <span>enable</span>
    </label>
    <label>
      <span>speed</span>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        bind:value={autoSpeed}
      />
      <output>{autoSpeed.toFixed(2)}</output>
    </label>
  </fieldset>

  <fieldset>
    <legend>debug</legend>
    <label>
      <input type="checkbox" bind:checked={showPoints} />
      <span>show control points</span>
    </label>
    <label>
      <input type="checkbox" bind:checked={showPath} />
      <span>show auto-fly path</span>
    </label>
  </fieldset>
</aside>

<style>
  section {
    aspect-ratio: 1 / 1;
  }
  canvas {
    background: #fffce0;
    border-radius: 0.25rem;
    touch-action: none;
    cursor: grab;
  }
  canvas:active {
    cursor: grabbing;
  }
  section > menu {
    bottom: 0.5rem;
    left: 0.5rem;
    align-items: center;
  }
  svg polyline {
    fill: none;
  }
  svg circle {
    stroke: white;
    stroke-width: 1.5;
  }
</style>
