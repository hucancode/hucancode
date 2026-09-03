<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import { clamp } from "$lib/playgrounds/collision/sat.js";
  import { sampleScene, aabbOfShape, aabbOverlap } from "$lib/playgrounds/collision/bvh.js";

  const W = 640;
  const H = 360;
  const WORLD_Y = 2.4;
  const SCALE = H / (2 * WORLD_Y);
  const WORLD_X = W / (2 * SCALE);

  const COLORS = [
    "#2563eb", "#f59e0b", "#16a34a", "#dc2626",
    "#7c3aed", "#0891b2", "#db2777", "#65a30d",
  ];

  let objects = $state(sampleScene());
  let canvas = $state();
  let ctx = $state(null);
  let dragIndex = $state(-1);

  const bounds = $derived(objects.map((o) => aabbOfShape(o)));
  const pairs = $derived.by(() => {
    const out = [];
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        if (aabbOverlap(bounds[i], bounds[j])) out.push([i, j]);
      }
    }
    return out;
  });
  const totalPairs = $derived((objects.length * (objects.length - 1)) / 2);

  const toX = (wx) => W / 2 + wx * SCALE;
  const toY = (wy) => H / 2 - wy * SCALE;
  const toWorld = (sx, sy) => [(sx - W / 2) / SCALE, (H / 2 - sy) / SCALE];

  function ensureCtx() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    if (!ctx) ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    ensureCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(128,128,150,0.16)";
    ctx.lineWidth = 1;
    for (let x = Math.ceil(-WORLD_X); x <= Math.ceil(WORLD_X); x++) {
      ctx.beginPath();
      ctx.moveTo(toX(x), 0);
      ctx.lineTo(toX(x), H);
      ctx.stroke();
    }
    for (let y = -2; y <= 2; y++) {
      ctx.beginPath();
      ctx.moveTo(0, toY(y));
      ctx.lineTo(W, toY(y));
      ctx.stroke();
    }

    // solid boxes — a box primitive is its own AABB
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i];
      const inPair = pairs.some((p) => p[0] === i || p[1] === i);
      const x = toX(o.c[0] - o.h[0]);
      const y = toY(o.c[1] + o.h[1]);
      const w = o.h[0] * 2 * SCALE;
      const h = o.h[1] * 2 * SCALE;
      ctx.fillStyle = inPair ? "rgba(220,38,38,0.22)" : "rgba(128,128,150,0.18)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = inPair ? "#dc2626" : COLORS[i % COLORS.length];
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.font = `${Math.floor(Math.min(w, h) * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.emoji, toX(o.c[0]), toY(o.c[1]));
    }

    // connectors for the overlapping pairs
    for (const [i, j] of pairs) {
      const a = objects[i].c;
      const b = objects[j].c;
      ctx.strokeStyle = "rgba(220,38,38,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(a[0]), toY(a[1]));
      ctx.lineTo(toX(b[0]), toY(b[1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (Math.abs(wx - o.c[0]) <= o.h[0] + 0.15 && Math.abs(wy - o.c[1]) <= o.h[1] + 0.15) {
        dragIndex = i;
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
  }

  function onMove(e) {
    if (dragIndex < 0) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    const o = objects[dragIndex];
    o.c[0] = clamp(wx, -WORLD_X + o.h[0], WORLD_X - o.h[0]);
    o.c[1] = clamp(wy, -WORLD_Y + o.h[1], WORLD_Y - o.h[1]);
  }

  function onUp(e) {
    dragIndex = -1;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  $effect(() => {
    bounds;
    pairs;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Box primitives with overlapping pairs highlighted"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <fieldset class="readout">
      <legend>scene</legend>
      <label>
        <span>pairs total</span>
        <output>{totalPairs}</output>
      </label>
      <label>
        <span>AABB-overlapping pairs</span>
        <output data-mood={pairs.length ? "hit" : "miss"}>{pairs.length}</output>
      </label>
    </fieldset>

    <div class="legend">
      <span><i style="background:#dc2626"></i> overlapping</span>
    </div>
  </aside>
</div>
