<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import { capsuleCapsule } from "$lib/playgrounds/collision/primitives.js";

  const W = 720;
  const H = 440;
  const WORLD_Y = 3.2;
  const SCALE = H / (2 * WORLD_Y);
  const worldXHalf = (W / 2) / SCALE;

  let posA = $state([-1.5, 0.3]);
  let posB = $state([1.2, -0.2]);
  let angleA = $state(-18);
  let angleB = $state(24);
  let halfA = $state(1.1);
  let halfB = $state(1.0);
  let rA = $state(0.55);
  let rB = $state(0.5);

  let canvas = $state();
  let ctx = $state(null);
  let drag = $state(null);

  const radA = $derived((angleA * Math.PI) / 180);
  const radB = $derived((angleB * Math.PI) / 180);
  const dirA = $derived([Math.cos(radA), Math.sin(radA)]);
  const dirB = $derived([Math.cos(radB), Math.sin(radB)]);
  const capA = $derived({
    a: [posA[0] - dirA[0] * halfA, posA[1] - dirA[1] * halfA],
    b: [posA[0] + dirA[0] * halfA, posA[1] + dirA[1] * halfA],
    radius: rA,
  });
  const capB = $derived({
    a: [posB[0] - dirB[0] * halfB, posB[1] - dirB[1] * halfB],
    b: [posB[0] + dirB[0] * halfB, posB[1] + dirB[1] * halfB],
    radius: rB,
  });
  const res = $derived(capsuleCapsule(capA, capB));

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

  function drawAxis(cap) {
    ctx.strokeStyle = "rgba(128,128,150,0.55)";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(cap.a[0]), toY(cap.a[1]));
    ctx.lineTo(toX(cap.b[0]), toY(cap.b[1]));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dot(p, color, r = 5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toX(p[0]), toY(p[1]), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
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

    drawCapsule(capA, hit ? "rgba(37,99,235,0.30)" : "rgba(37,99,235,0.16)", "#2563eb");
    drawCapsule(capB, hit ? "rgba(245,158,11,0.32)" : "rgba(245,158,11,0.16)", "#f59e0b");
    drawAxis(capA);
    drawAxis(capB);

    // closest points on the two cores + the distance between them
    if (res.cpA && res.cpB) {
      ctx.strokeStyle = "rgba(16,185,129,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(toX(res.cpA[0]), toY(res.cpA[1]));
      ctx.lineTo(toX(res.cpB[0]), toY(res.cpB[1]));
      ctx.stroke();
      ctx.setLineDash([]);

      dot(res.cpA, "#16a34a");
      dot(res.cpB, "#16a34a");
    }

    if (hit) {
      dot(res.point, "#16a34a");
      arrow(
        toX(res.point[0]),
        toY(res.point[1]),
        toX(res.point[0] + res.normal[0] * (res.penetration + 0.25)),
        toY(res.point[1] + res.normal[1] * (res.penetration + 0.25)),
        "#16a34a",
        3,
      );
    }
  }

  function hitTest(wx, wy) {
    const distTo = (cap) => {
      const ab = [cap.b[0] - cap.a[0], cap.b[1] - cap.a[1]];
      const len2 = ab[0] * ab[0] + ab[1] * ab[1];
      let t = 0;
      if (len2 > 1e-12) {
        t = Math.min(Math.max(((wx - cap.a[0]) * ab[0] + (wy - cap.a[1]) * ab[1]) / len2, 0), 1);
      }
      const px = cap.a[0] + ab[0] * t;
      const py = cap.a[1] + ab[1] * t;
      return Math.hypot(wx - px, wy - py);
    };
    if (distTo(capB) <= rB + 0.2) return "B";
    if (distTo(capA) <= rA + 0.2) return "A";
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
    posA = [-1.5, 0.3];
    posB = [1.2, -0.2];
    angleA = -18;
    angleB = 24;
    halfA = 1.1;
    halfB = 1.0;
    rA = 0.55;
    rB = 0.5;
  }

  $effect(() => {
    posA;
    posB;
    angleA;
    angleB;
    halfA;
    halfB;
    rA;
    rB;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Cylinder versus cylinder collision explorer"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>cylinder A</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.25" max="1.2" step="0.05" bind:value={rA} />
          <output>{rA.toFixed(2)}</output>
        </label>
        <label>
          <span>half length</span>
          <input type="range" min="0.4" max="2.0" step="0.05" bind:value={halfA} />
          <output>{halfA.toFixed(2)}</output>
        </label>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={angleA} />
          <output>{angleA}°</output>
        </label>
      </fieldset>
      <fieldset>
        <legend>cylinder B</legend>
        <label>
          <span>radius</span>
          <input type="range" min="0.25" max="1.2" step="0.05" bind:value={rB} />
          <output>{rB.toFixed(2)}</output>
        </label>
        <label>
          <span>half length</span>
          <input type="range" min="0.4" max="2.0" step="0.05" bind:value={halfB} />
          <output>{halfB.toFixed(2)}</output>
        </label>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={angleB} />
          <output>{angleB}°</output>
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
        <span>axes</span>
        <output>{res.parallel ? "parallel" : "crossed"}</output>
      </label>
      <label>
        <span>closest distance <Tex tex="d" /></span>
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
      If the two axes are parallel the problem collapses to circle-versus-circle in the plane across the
      axes, plus a height-overlap check. If they cross, the test finds the closest points between the two
      axis segments and compares that distance to the radius sum.
    </p>
  </aside>
</div>
