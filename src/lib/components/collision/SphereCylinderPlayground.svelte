<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import { circleCapsule } from "$lib/playgrounds/collision/primitives.js";

  const W = 720;
  const H = 440;
  const WORLD_Y = 3.2;
  const SCALE = H / (2 * WORLD_Y);
  const worldXHalf = (W / 2) / SCALE;

  let pos = $state([-1.5, 0.4]);
  let r = $state(0.8);
  let capR = $state(0.6);
  let halfLen = $state(1.2);
  let capDeg = $state(-24);
  let capPos = $state([1.0, 0.0]);

  let canvas = $state();
  let ctx = $state(null);
  let drag = $state(null);

  const capAngle = $derived((capDeg * Math.PI) / 180);
  const axisDir = $derived([Math.cos(capAngle), Math.sin(capAngle)]);
  const capsule = $derived({
    a: [capPos[0] - axisDir[0] * halfLen, capPos[1] - axisDir[1] * halfLen],
    b: [capPos[0] + axisDir[0] * halfLen, capPos[1] + axisDir[1] * halfLen],
    radius: capR,
  });
  const circle = $derived({ center: pos, radius: r });
  const res = $derived(circleCapsule(circle, capsule));

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

  function drawCapsule(cap, fill, stroke) {
    const ax = toX(cap.a[0]);
    const ay = toY(cap.a[1]);
    const bx = toX(cap.b[0]);
    const by = toY(cap.b[1]);
    const rp = cap.radius * SCALE;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(ax - nx * rp, ay - ny * rp);
    ctx.lineTo(bx - nx * rp, by - ny * rp);
    ctx.arc(bx, by, rp, ang - Math.PI / 2, ang + Math.PI / 2, false);
    ctx.lineTo(ax + nx * rp, ay + ny * rp);
    ctx.arc(ax, ay, rp, ang + Math.PI / 2, ang - Math.PI / 2, false);
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

    // cylinder (capsule in side view)
    drawCapsule(capsule, hit ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.16)", "#f59e0b");

    // axis segment
    ctx.strokeStyle = "rgba(128,128,150,0.55)";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(capsule.a[0]), toY(capsule.a[1]));
    ctx.lineTo(toX(capsule.b[0]), toY(capsule.b[1]));
    ctx.stroke();
    ctx.setLineDash([]);

    // closest point on the axis + vector to circle center
    ctx.strokeStyle = "rgba(16,185,129,0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(pos[0]), toY(pos[1]));
    ctx.lineTo(toX(res.axis[0]), toY(res.axis[1]));
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

    // closest point on the axis
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(toX(res.axis[0]), toY(res.axis[1]), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (hit) {
      // closest point on the capsule surface
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(toX(res.surface[0]), toY(res.surface[1]), 4, 0, Math.PI * 2);
      ctx.fill();

      // normal (from circle toward capsule), drawn from the contact point
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
    if (Math.hypot(wx - pos[0], wy - pos[1]) <= r + 0.15) return "circle";
    // distance to the capsule core segment
    const ab = [capsule.b[0] - capsule.a[0], capsule.b[1] - capsule.a[1]];
    const len2 = ab[0] * ab[0] + ab[1] * ab[1];
    let t = 0;
    if (len2 > 1e-12) {
      t = Math.min(Math.max(((wx - capsule.a[0]) * ab[0] + (wy - capsule.a[1]) * ab[1]) / len2, 0), 1);
    }
    const px = capsule.a[0] + ab[0] * t;
    const py = capsule.a[1] + ab[1] * t;
    if (Math.hypot(wx - px, wy - py) <= capR + 0.2) return "capsule";
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
    else capPos = [x, y];
  }
  function onUp(e) {
    drag = null;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  function reset() {
    pos = [-1.5, 0.4];
    capPos = [1.0, 0.0];
    r = 0.8;
    capR = 0.6;
    halfLen = 1.2;
    capDeg = -24;
  }

  $effect(() => {
    pos;
    r;
    capR;
    halfLen;
    capDeg;
    capPos;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Sphere versus cylinder collision explorer"
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
        <legend>cylinder</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.25" max="1.2" step="0.05" bind:value={capR} />
          <output>{capR.toFixed(2)}</output>
        </label>
        <label>
          <span>half length</span>
          <input type="range" min="0.4" max="2.0" step="0.05" bind:value={halfLen} />
          <output>{halfLen.toFixed(2)}</output>
        </label>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={capDeg} />
          <output>{capDeg}°</output>
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
        <span>closest on axis <Tex tex="t" /></span>
        <output>{res.t.toFixed(2)} ({res.region})</output>
      </label>
      <label>
        <span>axis distance <Tex tex="d" /></span>
        <output>{fmt(res.dist)}</output>
      </label>
      <label>
        <span>radius sum</span>
        <output>{fmt(res.radiusSum)}</output>
      </label>
      {#if res.hit}
        <label>
          <span>penetration</span>
          <output>{fmt(res.penetration)}</output>
        </label>
      {/if}
    </fieldset>

    <p class="note">
      Seen from the side a cylinder is a capsule: an axis segment inflated by the radius. The test finds the
      closest point on that axis, then asks which <em>region</em> the sphere center is in — past an end cap or
      alongside the curved wall — and that region decides the surface normal.
    </p>
  </aside>
</div>
