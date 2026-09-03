<script>
  import { clamp } from "$lib/playgrounds/collision/sat.js";
  import { sampleScene, buildBVH, queryBVH } from "$lib/playgrounds/collision/bvh.js";

  const W = 640;
  const H = 360;
  const WORLD_Y = 2.4;
  const SCALE = H / (2 * WORLD_Y);
  const WORLD_X = W / (2 * SCALE);

  let scene = $state(sampleScene());
  const tree = $derived(buildBVH(scene));

  let qx = $state(0.3);
  let qy = $state(-0.1);
  let qhx = $state(1.3);
  let qhy = $state(1.3);

  let canvas = $state();
  let ctx = $state(null);
  let dragging = $state(false);

  const query = $derived({ min: [qx - qhx, qy - qhy], max: [qx + qhx, qy + qhy] });
  const result = $derived(queryBVH(tree, query));
  const candidateSet = $derived(new Set(result.candidates.map((o) => o.id)));
  const visitedInternal = $derived(result.visited.filter((n) => !n.leaf));

  const toX = (wx) => W / 2 + wx * SCALE;
  const toY = (wy) => H / 2 - wy * SCALE;
  const toWorld = (sx, sy) => [(sx - W / 2) / SCALE, (H / 2 - sy) / SCALE];

  const EMOJIS = [
    "🍎", "🍌", "🍇", "🍓", "🍒", "🍑", "🍍", "🥝",
    "🍉", "🍊", "🍋", "🫐", "🥭", "🍐", "🍈", "🍏",
    "🫒", "🥥", "🍅", "🥕", "🌽", "🍆", "🥔", "🧅",
  ];
  const rand = (a, b) => a + Math.random() * (b - a);

  function addItem() {
    const id = scene.reduce((m, o) => Math.max(m, o.id), -1) + 1;
    scene.push({
      id,
      type: "box",
      c: [rand(-3.6, 3.6), rand(-1.9, 1.9)],
      h: [rand(0.12, 0.24), rand(0.1, 0.18)],
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    });
  }

  function clearScene() {
    scene = [];
  }

  function resetScene() {
    scene = sampleScene();
  }

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

    // visited internal nodes (the traversal path)
    for (const n of visitedInternal) {
      strokeAabb(n.aabb, "#2563eb", 1.25);
    }

    // objects: candidates highlighted, the rest left faint
    for (let i = 0; i < scene.length; i++) {
      const o = scene[i];
      const hit = candidateSet.has(o.id);
      const x = toX(o.c[0] - o.h[0]);
      const y = toY(o.c[1] + o.h[1]);
      const w = o.h[0] * 2 * SCALE;
      const h = o.h[1] * 2 * SCALE;
      ctx.fillStyle = hit ? "rgba(22,163,74,0.2)" : "rgba(128,128,150,0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = hit ? "#16a34a" : "rgba(128,128,150,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.font = `${Math.floor(Math.min(w, h) * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(o.emoji, toX(o.c[0]), toY(o.c[1]));
    }

    // query box
    const qx0 = toX(query.min[0]);
    const qy0 = toY(query.max[1]);
    const qw = (query.max[0] - query.min[0]) * SCALE;
    const qh = (query.max[1] - query.min[1]) * SCALE;
    ctx.fillStyle = "rgba(245,158,11,0.1)";
    ctx.fillRect(qx0, qy0, qw, qh);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(qx0, qy0, qw, qh);

    // query center handle
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(toX(qx), toY(qy), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    if (Math.abs(wx - qx) <= qhx + 0.3 && Math.abs(wy - qy) <= qhy + 0.3) {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
    }
  }

  function onMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    qx = clamp(wx, -WORLD_X + qhx, WORLD_X - qhx);
    qy = clamp(wy, -WORLD_Y + qhy, WORLD_Y - qhy);
  }

  function onUp(e) {
    dragging = false;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  $effect(() => {
    qx;
    qy;
    qhx;
    qhy;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Traversing a BVH with a query box, showing pruned and visited nodes"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>scene</legend>
        <menu>
          <li><button onclick={addItem}>+ item</button></li>
          <li><button onclick={clearScene}>clear</button></li>
          <li><button onclick={resetScene}>reset</button></li>
        </menu>
      </fieldset>

      <fieldset>
        <legend>query box</legend>
        <label>
          <span>half x</span>
          <input type="range" min="0.4" max="2.6" step="0.05" bind:value={qhx} />
          <output>{qhx.toFixed(2)}</output>
        </label>
        <label>
          <span>half y</span>
          <input type="range" min="0.4" max="2.2" step="0.05" bind:value={qhy} />
          <output>{qhy.toFixed(2)}</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>traversal</legend>
      <label>
        <span>items</span>
        <output>{scene.length}</output>
      </label>
      <label>
        <span>boxes tested</span>
        <output>{result.visited.length}</output>
      </label>
      <label>
        <span>candidates</span>
        <output data-mood={result.candidates.length ? "hit" : "miss"}>{result.candidates.length}</output>
      </label>
    </fieldset>

    <div class="legend">
      <span><i style="background:#f59e0b"></i> query box</span>
      <span><i style="background:#2563eb"></i> visited node</span>
      <span><i style="background:#16a34a"></i> hit candidate</span>
    </div>
  </aside>
</div>
