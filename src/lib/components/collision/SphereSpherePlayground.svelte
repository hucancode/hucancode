<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import { circleCircle } from "$lib/playgrounds/collision/primitives.js";

  const W = 720;
  const H = 440;
  const WORLD_Y = 3.2;
  const SCALE = H / (2 * WORLD_Y);
  const worldXHalf = (W / 2) / SCALE;

  let posA = $state([-1.3, 0.4]);
  let posB = $state([1.1, -0.3]);
  let rA = $state(1.0);
  let rB = $state(0.85);

  let canvas = $state();
  let ctx = $state(null);
  let drag = $state(null);

  const circleA = $derived({ center: posA, radius: rA });
  const circleB = $derived({ center: posB, radius: rB });
  const res = $derived(circleCircle(circleA, circleB));

  const toX = (wx) => W / 2 + wx * SCALE;
  const toY = (wy) => H / 2 - wy * SCALE;
  const toWorld = (sx, sy) => [(sx - W / 2) / SCALE, (H / 2 - sy) / SCALE];

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(3));

  function themeInk() {
    if (typeof document === "undefined") return "#16161d";
    return getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#16161d";
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

  function circleShape(center, r, fill, stroke, strokeWidth = 2.5) {
    ctx.beginPath();
    ctx.arc(toX(center[0]), toY(center[1]), r * SCALE, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  function draw() {
    ensureCtx();
    if (!ctx) return;
    const ink = themeInk();
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

    // center-to-center line
    ctx.strokeStyle = hit ? "rgba(220,38,38,0.55)" : "rgba(128,128,150,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(toX(posA[0]), toY(posA[1]));
    ctx.lineTo(toX(posB[0]), toY(posB[1]));
    ctx.stroke();
    ctx.setLineDash([]);

    circleShape(posA, rA, hit ? "rgba(37,99,235,0.30)" : "rgba(37,99,235,0.16)", "#2563eb");
    circleShape(posB, rB, hit ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.16)", "#f59e0b");

    // radius ticks
    ctx.strokeStyle = "rgba(37,99,235,0.8)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(toX(posA[0]), toY(posA[1]));
    ctx.lineTo(toX(posA[0] + rA), toY(posA[1]));
    ctx.stroke();
    ctx.strokeStyle = "rgba(245,158,11,0.8)";
    ctx.beginPath();
    ctx.moveTo(toX(posB[0]), toY(posB[1]));
    ctx.lineTo(toX(posB[0] - rB), toY(posB[1]));
    ctx.stroke();

    if (hit) {
      // contact point
      ctx.fillStyle = "#16a34a";
      ctx.beginPath();
      ctx.arc(toX(res.point[0]), toY(res.point[1]), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // normal (from A to B) drawn from the contact point
      arrow(
        toX(res.point[0]),
        toY(res.point[1]),
        toX(res.point[0] + res.normal[0] * (res.penetration + 0.25)),
        toY(res.point[1] + res.normal[1] * (res.penetration + 0.25)),
        "#16a34a",
        3,
      );
    }

    // labels
    ctx.fillStyle = ink;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A", toX(posA[0]), toY(posA[1] + rA) + 16);
    ctx.fillText("B", toX(posB[0]), toY(posB[1] - rB) - 8);
    ctx.textAlign = "start";
  }

  function hitTest(wx, wy) {
    const da = Math.hypot(wx - posA[0], wy - posA[1]);
    const db = Math.hypot(wx - posB[0], wy - posB[1]);
    if (da <= rA + 0.15) return "A";
    if (db <= rB + 0.15) return "B";
    if (Math.min(da, db) < 1.0) return da <= db ? "A" : "B";
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
    if (drag === "A") posA = [x, y];
    else posB = [x, y];
  }
  function onUp(e) {
    drag = null;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  function reset() {
    posA = [-1.3, 0.4];
    posB = [1.1, -0.3];
    rA = 1.0;
    rB = 0.85;
  }

  $effect(() => {
    posA;
    posB;
    rA;
    rB;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Sphere versus sphere collision explorer"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>sphere A</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.3" max="1.8" step="0.05" bind:value={rA} />
          <output>{rA.toFixed(2)}</output>
        </label>
      </fieldset>
      <fieldset>
        <legend>sphere B</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.3" max="1.8" step="0.05" bind:value={rB} />
          <output>{rB.toFixed(2)}</output>
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
        <span>distance <Tex tex="d" /></span>
        <output>{fmt(res.dist)}</output>
      </label>
      <label>
        <span>sum radii <Tex tex="r_A+r_B" /></span>
        <output>{fmt(res.radiusSum)}</output>
      </label>
      {#if res.hit}
        <label>
          <span>penetration</span>
          <output>{fmt(res.penetration)}</output>
        </label>
        <label>
          <span>normal <Tex tex="\hat n" /></span>
          <output>({res.normal[0].toFixed(2)}, {res.normal[1].toFixed(2)})</output>
        </label>
      {/if}
    </fieldset>
  </aside>
</div>
