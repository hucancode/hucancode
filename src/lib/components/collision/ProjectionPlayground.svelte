<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import {
    boxFrame,
    boxCorners,
    projectBox,
    vdot,
    vnorm,
  } from "$lib/playgrounds/collision/sat.js";

  // Fixed internal resolution; CSS scales it responsively.
  const W = 640;
  const H = 360;
  const WORLD_Y = 2.4;
  const SCALE = H / (2 * WORLD_Y); // px per world unit
  const HANDLE_R = 2.0;

  let boxDeg = $state(23);
  let axisDeg = $state(52);
  let hx = $state(1.5);
  let hy = $state(0.9);

  let canvas = $state();
  let ctx = $state(null);
  let dragging = $state(false);

  const boxAngle = $derived((boxDeg * Math.PI) / 180);
  const axisAngle = $derived((axisDeg * Math.PI) / 180);
  const frame = $derived(boxFrame([0, 0], [hx, hy], boxAngle));
  const axis = $derived(vnorm([Math.cos(axisAngle), Math.sin(axisAngle)]));
  const proj = $derived(projectBox(frame, axis));
  const corners = $derived(boxCorners(frame));

  // Which corners cast the two extreme shadows.
  const extreme = $derived.by(() => {
    let lo = corners[0];
    let hi = corners[0];
    let loV = Infinity;
    let hiV = -Infinity;
    for (const c of corners) {
      const v = vdot(c, axis);
      if (v < loV) {
        loV = v;
        lo = c;
      }
      if (v > hiV) {
        hiV = v;
        hi = c;
      }
    }
    return { lo, hi };
  });

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
    ctx.strokeStyle = "rgba(128,128,150,0.18)";
    ctx.lineWidth = 1;
    for (let x = Math.ceil(-4); x <= 4; x++) {
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

    // the separating-axis candidate: a line through the origin along `axis`
    const n = axis;
    const lx = n[0] * 6;
    const ly = n[1] * 6;
    ctx.strokeStyle = "rgba(120,120,150,0.55)";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(toX(-lx), toY(-ly));
    ctx.lineTo(toX(lx), toY(ly));
    ctx.stroke();
    ctx.setLineDash([]);

    // shadow interval on the axis
    const p0 = [n[0] * proj.min, n[1] * proj.min];
    const p1 = [n[0] * proj.max, n[1] * proj.max];
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(toX(p0[0]), toY(p0[1]));
    ctx.lineTo(toX(p1[0]), toY(p1[1]));
    ctx.stroke();
    ctx.lineCap = "butt";

    // dashed connectors from the extreme corners to their shadows
    ctx.strokeStyle = "rgba(22,163,74,0.6)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    for (const c of [extreme.lo, extreme.hi]) {
      const v = vdot(c, axis);
      const pr = [n[0] * v, n[1] * v];
      ctx.beginPath();
      ctx.moveTo(toX(c[0]), toY(c[1]));
      ctx.lineTo(toX(pr[0]), toY(pr[1]));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // box
    ctx.beginPath();
    corners.forEach((c, i) => {
      i === 0 ? ctx.moveTo(toX(c[0]), toY(c[1])) : ctx.lineTo(toX(c[0]), toY(c[1]));
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(37,99,235,0.16)";
    ctx.fill();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();

    // corners
    ctx.fillStyle = "#2563eb";
    for (const c of corners) {
      ctx.beginPath();
      ctx.arc(toX(c[0]), toY(c[1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // axis handle (grab me)
    const hx0 = n[0] * HANDLE_R;
    const hy0 = n[1] * HANDLE_R;
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(toX(hx0), toY(hy0), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // arrowhead at the handle end
    const tip = [n[0] * (HANDLE_R + 0.22), n[1] * (HANDLE_R + 0.22)];
    const perp = [-n[1], n[0]];
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.moveTo(toX(tip[0]), toY(tip[1]));
    ctx.lineTo(toX(hx0 - perp[0] * 0.18), toY(hy0 - perp[1] * 0.18));
    ctx.lineTo(toX(hx0 + perp[0] * 0.18), toY(hy0 + perp[1] * 0.18));
    ctx.closePath();
    ctx.fill();
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    const n = axis;
    const hxp = toX(n[0] * HANDLE_R);
    const hyp = toY(n[1] * HANDLE_R);
    if (Math.hypot(sx - hxp, sy - hyp) < 20) {
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
    axisDeg = (Math.atan2(wy, wx) * 180) / Math.PI;
  }
  function onUp(e) {
    dragging = false;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  $effect(() => {
    // track state
    boxDeg;
    axisDeg;
    hx;
    hy;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Projection of an oriented box onto an axis"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>box</legend>
        <label>
          <span>angle</span>
          <input type="range" min="-180" max="180" step="5" bind:value={boxDeg} />
          <output>{boxDeg}°</output>
        </label>
        <label>
          <span>half x</span>
          <input type="range" min="0.4" max="2.2" step="0.05" bind:value={hx} />
          <output>{hx.toFixed(2)}</output>
        </label>
        <label>
          <span>half y</span>
          <input type="range" min="0.3" max="1.6" step="0.05" bind:value={hy} />
          <output>{hy.toFixed(2)}</output>
        </label>
      </fieldset>

      <fieldset>
        <legend>axis</legend>
        <label>
          <span>angle</span>
          <input type="range" min="-180" max="180" step="5" bind:value={axisDeg} />
          <output>{axisDeg.toFixed(0)}°</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>shadow</legend>
      <label>
        <span>length <Tex tex="\max-\min" /></span>
        <output>{(proj.max - proj.min).toFixed(3)}</output>
      </label>
      <label>
        <span>formula <Tex tex="2(h_x|a_x\!\cdot\! n| + h_y|a_y\!\cdot\! n|)" /></span>
        <output>{(2 * (hx * Math.abs(vdot(frame.axes[0], axis)) + hy * Math.abs(vdot(frame.axes[1], axis)))).toFixed(3)}</output>
      </label>
    </fieldset>

    <p class="note">
      The box's <em>projection</em> onto an axis is the interval its corners land on. Two shapes collide on
      that axis exactly when their intervals overlap — that one fact is all of SAT.
    </p>
  </aside>
</div>
