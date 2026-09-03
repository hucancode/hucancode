<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import { boxFrame, boxCorners } from "$lib/playgrounds/collision/sat.js";
  import { circleBox } from "$lib/playgrounds/collision/primitives.js";

  const W = 720;
  const H = 440;
  const WORLD_Y = 3.2;
  const SCALE = H / (2 * WORLD_Y);
  const worldXHalf = (W / 2) / SCALE;

  let pos = $state([-1.4, 0.5]);
  let r = $state(0.9);
  let hx = $state(1.5);
  let hy = $state(0.9);
  let boxDeg = $state(14);
  let boxPos = $state([1.0, -0.2]);

  let canvas = $state();
  let ctx = $state(null);
  let drag = $state(null);

  const boxAngle = $derived((boxDeg * Math.PI) / 180);
  const box = $derived(boxFrame(boxPos, [hx, hy], boxAngle));
  const circle = $derived({ center: pos, radius: r });
  const res = $derived(circleBox(circle, box));

  const toX = (wx) => W / 2 + wx * SCALE;
  const toY = (wy) => H / 2 - wy * SCALE;
  const toWorld = (sx, sy) => [(sx - W / 2) / SCALE, (H / 2 - sy) / SCALE];

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(3));

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

  function arrow(x1, y1, x2, y2, color, width = 2.5) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const h = 10;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - h * Math.cos(ang - 0.4), y2 - h * Math.sin(ang - 0.4));
    ctx.lineTo(x2 - h * Math.cos(ang + 0.4), y2 - h * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  function drawBox(b, fill, stroke) {
    const c = boxCorners(b).map((p) => [toX(p[0]), toY(p[1])]);
    ctx.beginPath();
    c.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function draw() {
    ensureCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = "rgba(128,128,150,0.18)";
    ctx.lineWidth = 1;
    for (let x = Math.ceil(-6); x <= 6; x++) {
      ctx.beginPath();
      ctx.moveTo(toX(x), 0);
      ctx.lineTo(toX(x), H);
      ctx.stroke();
    }
    for (let y = -3; y <= 3; y++) {
      ctx.beginPath();
      ctx.moveTo(0, toY(y));
      ctx.lineTo(W, toY(y));
      ctx.stroke();
    }

    const hit = res.hit;

    drawBox(box, hit ? "rgba(245,158,11,0.24)" : "rgba(245,158,11,0.13)", "#f59e0b");

    // closest point on box to the circle center
    ctx.strokeStyle = "rgba(16,185,129,0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(pos[0]), toY(pos[1]));
    ctx.lineTo(toX(res.closest[0]), toY(res.closest[1]));
    ctx.stroke();
    ctx.setLineDash([]);

    // circle
    ctx.beginPath();
    ctx.arc(toX(pos[0]), toY(pos[1]), r * SCALE, 0, Math.PI * 2);
    ctx.fillStyle = hit ? "rgba(37,99,235,0.30)" : "rgba(37,99,235,0.16)";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // closest point
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(toX(res.closest[0]), toY(res.closest[1]), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (hit) {
      // normal (from circle toward box), drawn from the contact point
      arrow(
        toX(res.point[0]),
        toY(res.point[1]),
        toX(res.point[0] + res.normal[0] * (res.penetration + 0.3)),
        toY(res.point[1] + res.normal[1] * (res.penetration + 0.3)),
        "#16a34a",
        3,
      );
    }

  }

  function hitTest(wx, wy) {
    // sphere first
    if (Math.hypot(wx - pos[0], wy - pos[1]) <= r + 0.15) return "circle";
    // then box in its local frame
    const d = [wx - boxPos[0], wy - boxPos[1]];
    const lx = d[0] * box.axes[0][0] + d[1] * box.axes[0][1];
    const ly = d[0] * box.axes[1][0] + d[1] * box.axes[1][1];
    if (Math.abs(lx) <= hx + 0.2 && Math.abs(ly) <= hy + 0.2) return "box";
    return null;
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    drag = hitTest(wx, wy);
    if (drag) canvas.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const [wx, wy] = toWorld(sx, sy);
    const x = Math.min(Math.max(wx, -worldXHalf + 0.3), worldXHalf - 0.3);
    const y = Math.min(Math.max(wy, -WORLD_Y + 0.3), WORLD_Y - 0.3);
    if (drag === "circle") pos = [x, y];
    else boxPos = [x, y];
  }
  function onUp(e) {
    drag = null;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  function reset() {
    pos = [-1.4, 0.5];
    boxPos = [1.0, -0.2];
    r = 0.9;
    hx = 1.5;
    hy = 0.9;
    boxDeg = 14;
  }

  $effect(() => {
    pos;
    r;
    hx;
    hy;
    boxDeg;
    boxPos;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Sphere versus box collision explorer"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>sphere</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.3" max="1.6" step="0.05" bind:value={r} />
          <output>{r.toFixed(2)}</output>
        </label>
      </fieldset>
      <fieldset>
        <legend>box</legend>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={boxDeg} />
          <output>{boxDeg}°</output>
        </label>
        <label>
          <span>half x</span>
          <input type="range" min="0.5" max="2.4" step="0.05" bind:value={hx} />
          <output>{hx.toFixed(2)}</output>
        </label>
        <label>
          <span>half y</span>
          <input type="range" min="0.4" max="1.8" step="0.05" bind:value={hy} />
          <output>{hy.toFixed(2)}</output>
        </label>
      </fieldset>
      <menu>
        <li><button onclick={reset}>reset</button></li>
      </menu>
    </div>

    <fieldset class="readout">
      <legend>result</legend>
      <label>
        <span>status</span>
        <output data-mood={res.hit ? "hit" : "miss"}>{res.hit ? "overlap" : "separated"}</output>
      </label>
      <label>
        <span>closest point</span>
        <output>({res.closest[0].toFixed(2)}, {res.closest[1].toFixed(2)})</output>
      </label>
      <label>
        <span>distance <Tex tex="d" /></span>
        <output>{fmt(res.dist)}</output>
      </label>
      {#if res.hit}
        <label>
          <span>penetration</span>
          <output>{fmt(res.penetration)}</output>
        </label>
      {/if}
    </fieldset>

    <p class="note">
      A sphere hits a box when the <em>closest point on the box</em> to the sphere's center is within the
      sphere's radius. For an oriented box that closest point is one transform: go to the box's local frame,
      clamp each coordinate to the half extents, and transform back.
    </p>
  </aside>
</div>
