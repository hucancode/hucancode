<script>
  import { sampleScene, buildBVH, nodesAtDepth, maxDepth, countNodes } from "$lib/playgrounds/collision/bvh.js";

  const W = 640;
  const H = 360;
  const WORLD_Y = 2.4;
  const SCALE = H / (2 * WORLD_Y);
  const WORLD_X = W / (2 * SCALE);

  const scene = sampleScene();
  const tree = buildBVH(scene);
  const depthMax = maxDepth(tree);
  const nodeCount = countNodes(tree);

  let level = $state(0);
  let canvas = $state();
  let ctx = $state(null);

  const nodes = $derived(nodesAtDepth(tree, level));

  const toX = (wx) => W / 2 + wx * SCALE;
  const toY = (wy) => H / 2 - wy * SCALE;

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

  function fillAabb(a, color) {
    const x = toX(a.min[0]);
    const y = toY(a.max[1]);
    const w = (a.max[0] - a.min[0]) * SCALE;
    const h = (a.max[1] - a.min[1]) * SCALE;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function strokeAabb(a, color, width) {
    const x = toX(a.min[0]);
    const y = toY(a.max[1]);
    const w = (a.max[0] - a.min[0]) * SCALE;
    const h = (a.max[1] - a.min[1]) * SCALE;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x, y, w, h);
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

    // objects (faint, so the boxes at this level read clearly)
    for (let i = 0; i < scene.length; i++) {
      const o = scene[i];
      const x = toX(o.c[0] - o.h[0]);
      const y = toY(o.c[1] + o.h[1]);
      const w = o.h[0] * 2 * SCALE;
      const h = o.h[1] * 2 * SCALE;
      ctx.fillStyle = "rgba(128,128,150,0.14)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(128,128,150,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
    }

    // the node boxes at this level
    for (const n of nodes) {
      const leaf = !!n.leaf;
      fillAabb(n.aabb, leaf ? "rgba(22,163,74,0.14)" : "rgba(37,99,235,0.1)");
      strokeAabb(n.aabb, leaf ? "#16a34a" : "#2563eb", 1.25);
    }

    // item emoji on top
    for (let i = 0; i < scene.length; i++) {
      const o = scene[i];
      const w = o.h[0] * 2 * SCALE;
      const h = o.h[1] * 2 * SCALE;
      ctx.font = `${Math.floor(Math.min(w, h) * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.emoji, toX(o.c[0]), toY(o.c[1]));
    }
  }

  $effect(() => {
    level;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas bind:this={canvas} aria-label="Hierarchy levels of a BVH built from bounding boxes"></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>tree</legend>
        <label>
          <span>level</span>
          <input type="range" min="0" max={depthMax} step="1" bind:value={level} />
          <output>{level} / {depthMax}</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>hierarchy</legend>
      <label>
        <span>boxes at this level</span>
        <output>{nodes.length}</output>
      </label>
      <label>
        <span>objects in scene</span>
        <output>{scene.length}</output>
      </label>
      <label>
        <span>nodes total</span>
        <output>{nodeCount}</output>
      </label>
    </fieldset>
  </aside>
</div>
