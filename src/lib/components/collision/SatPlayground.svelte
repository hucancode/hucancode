<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import {
    boxFrame,
    boxCorners,
    satTest,
    mtv,
    contactPoints,
    vdot,
    vadd,
    vscale,
    clamp,
  } from "$lib/playgrounds/collision/sat.js";

  const W = 720;
  const H = 520;
  const STRIP_H = 118;
  const MAIN_H = H - STRIP_H;
  const WORLD_Y = 3.4;
  const SCALE = MAIN_H / (2 * WORLD_Y);

  let posA = $state([-1.5, 0.3]);
  let posB = $state([1.0, -0.2]);
  let angleADeg = $state(18);
  let angleBDeg = $state(-32);
  let hxA = $state(1.5);
  let hyA = $state(0.9);
  let hxB = $state(1.4);
  let hyB = $state(0.85);

  let pinned = $state(false);
  let selIndex = $state(0);

  let canvas = $state();
  let ctx = $state(null);
  let drag = $state(null);

  const angleA = $derived((angleADeg * Math.PI) / 180);
  const angleB = $derived((angleBDeg * Math.PI) / 180);
  const fa = $derived(boxFrame(posA, [hxA, hyA], angleA));
  const fb = $derived(boxFrame(posB, [hxB, hyB], angleB));
  const test = $derived(satTest(fa, fb));
  const m = $derived(mtv(test));
  const contacts = $derived(test.hit ? contactPoints(fa, fb, test.min) : null);
  const selectedIndex = $derived(pinned ? selIndex : test.minIndex);
  const sel = $derived(test.results[selectedIndex]);

  const worldXHalf = (W / 2) / SCALE;
  const mainToX = (wx) => W / 2 + wx * SCALE;
  const mainToY = (wy) => MAIN_H / 2 - wy * SCALE;
  const toWorld = (sx, sy) => [(sx - W / 2) / SCALE, (MAIN_H / 2 - sy) / SCALE];

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

  function polyPath(pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
    ctx.closePath();
  }

  function drawBox(f, fill, stroke) {
    const c = boxCorners(f).map((p) => [mainToX(p[0]), mainToY(p[1])]);
    polyPath(c);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();
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

  function drawFaceAxes(f, color) {
    for (const a of f.axes) {
      const x1 = mainToX(f.center[0]);
      const y1 = mainToY(f.center[1]);
      const x2 = mainToX(f.center[0] + a[0] * 1.1);
      const y2 = mainToY(f.center[1] + a[1] * 1.1);
      arrow(x1, y1, x2, y2, color, 1.75);
    }
  }

  function drawStrip() {
    const ink = themeInk();
    const left = 26;
    const right = W - 26;
    const top = MAIN_H;
    const axisY = top + 62;

    // divider
    ctx.strokeStyle = "rgba(128,128,150,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(W, top);
    ctx.stroke();

    const pa = sel.pa;
    const pb = sel.pb;
    const lo = Math.min(pa.min, pb.min);
    const hi = Math.max(pa.max, pb.max);
    const pad = Math.max((hi - lo) * 0.18, 0.4);
    const d0 = lo - pad;
    const d1 = hi + pad;
    const px = (s) => left + ((s - d0) / (d1 - d0)) * (right - left);

    // number line
    ctx.strokeStyle = "rgba(128,128,150,0.5)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(left, axisY);
    ctx.lineTo(right, axisY);
    ctx.stroke();

    // interval bars
    const bar = (x0, x1, y, color) => {
      ctx.fillStyle = color;
      roundRect(x0, y, x1 - x0, 13, 3);
      ctx.fill();
    };
    bar(px(pa.min), px(pa.max), axisY - 21, "rgba(37,99,235,0.85)");
    bar(px(pb.min), px(pb.max), axisY + 4, "rgba(245,158,11,0.85)");

    // overlap (green) or gap (red)
    const o0 = Math.max(pa.min, pb.min);
    const o1 = Math.min(pa.max, pb.max);
    ctx.fillStyle = o1 >= o0 ? "rgba(22,163,74,0.95)" : "rgba(220,38,38,0.9)";
    const ox0 = px(Math.min(o0, o1));
    const ox1 = px(Math.max(o0, o1));
    roundRect(ox0, axisY - 4, ox1 - ox0, 8, 2);
    ctx.fill();

    // tick labels
    ctx.fillStyle = ink;
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(fmt(pa.min), px(pa.min), axisY + 16);
    ctx.fillText(fmt(pa.max), px(pa.max), axisY + 16);
    ctx.textAlign = "left";
    ctx.fillText("A", px(pa.max) + 6, axisY - 19);
    ctx.fillText("B", px(pb.max) + 6, axisY + 6);
    ctx.textAlign = "start";
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
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
      ctx.moveTo(mainToX(x), 0);
      ctx.lineTo(mainToX(x), MAIN_H);
      ctx.stroke();
    }
    for (let y = -3; y <= 3; y++) {
      ctx.beginPath();
      ctx.moveTo(0, mainToY(y));
      ctx.lineTo(W, mainToY(y));
      ctx.stroke();
    }

    // selected axis direction line (through origin)
    const n = sel.axis;
    const lx = n[0] * 8;
    const ly = n[1] * 8;
    ctx.strokeStyle = "rgba(22,163,74,0.5)";
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(mainToX(-lx), mainToY(-ly));
    ctx.lineTo(mainToX(lx), mainToY(ly));
    ctx.stroke();
    ctx.setLineDash([]);

    // projection intervals along the axis — solid colored lines mirroring the
    // three bars in the strip below (A, B, and their overlap/gap).
    const projPt = (s) => [mainToX(n[0] * s), mainToY(n[1] * s)];
    const drawProj = (s0, s1, color, width) => {
      const p0 = projPt(s0);
      const p1 = projPt(s1);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
      ctx.lineCap = "butt";
    };
    const pa = sel.pa;
    const pb = sel.pb;
    drawProj(pa.min, pa.max, "rgba(37,99,235,0.95)", 4);
    drawProj(pb.min, pb.max, "rgba(245,158,11,0.95)", 4);
    const o0 = Math.max(pa.min, pb.min);
    const o1 = Math.min(pa.max, pb.max);
    drawProj(
      Math.min(o0, o1),
      Math.max(o0, o1),
      o1 >= o0 ? "rgba(22,163,74,0.95)" : "rgba(220,38,38,0.9)",
      6,
    );

    // boxes
    drawBox(fa, "rgba(37,99,235,0.14)", "#2563eb");
    drawBox(fb, "rgba(245,158,11,0.14)", "#f59e0b");

    // reference + incident faces (contact geometry)
    if (contacts) {
      const re = contacts.refEdge;
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(mainToX(re.a[0]), mainToY(re.a[1]));
      ctx.lineTo(mainToX(re.b[0]), mainToY(re.b[1]));
      ctx.stroke();
      const ie = contacts.incEdge;
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(mainToX(ie.a[0]), mainToY(ie.a[1]));
      ctx.lineTo(mainToX(ie.b[0]), mainToY(ie.b[1]));
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    // face-normal candidate axes
    drawFaceAxes(fa, "#2563eb");
    drawFaceAxes(fb, "#f59e0b");

    // contact points + MTV
    if (contacts && contacts.points.length) {
      const cx = contacts.points.reduce((s, p) => vadd(s, p), [0, 0]);
      const centroid = vscale(cx, 1 / contacts.points.length);
      ctx.fillStyle = "#16a34a";
      for (const p of contacts.points) {
        ctx.beginPath();
        ctx.arc(mainToX(p[0]), mainToY(p[1]), 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // MTV arrow: the minimum translation that separates the boxes
      if (test.hit) {
        arrow(
          mainToX(centroid[0]),
          mainToY(centroid[1]),
          mainToX(centroid[0] + m[0]),
          mainToY(centroid[1] + m[1]),
          "#16a34a",
          3,
        );
      }
    }

    // center labels
    ctx.fillStyle = ink;
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A", mainToX(fa.center[0]), mainToY(fa.center[1]) - 16);
    ctx.fillText("B", mainToX(fb.center[0]), mainToY(fb.center[1]) - 16);
    ctx.textAlign = "start";

    drawStrip();
  }

  function hitTest(wx, wy) {
    const inside = (f, pad) => {
      const dx = wx - f.center[0];
      const dy = wy - f.center[1];
      const lx = vdot([dx, dy], f.axes[0]);
      const ly = vdot([dx, dy], f.axes[1]);
      return Math.abs(lx) <= f.half[0] + pad && Math.abs(ly) <= f.half[1] + pad;
    };
    if (inside(fb, 0.28)) return "B";
    if (inside(fa, 0.28)) return "A";
    // fallback: nearest center
    const da = Math.hypot(wx - fa.center[0], wy - fa.center[1]);
    const db = Math.hypot(wx - fb.center[0], wy - fb.center[1]);
    if (Math.min(da, db) < 1.0) return da <= db ? "A" : "B";
    return null;
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    if (sy > MAIN_H) return; // projection strip is not draggable
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
    const x = clamp(wx, -worldXHalf + 0.4, worldXHalf - 0.4);
    const y = clamp(wy, -WORLD_Y + 0.4, WORLD_Y - 0.4);
    if (drag === "A") posA = [x, y];
    else posB = [x, y];
  }
  function onUp(e) {
    drag = null;
    canvas?.releasePointerCapture?.(e.pointerId);
  }

  function reset() {
    posA = [-1.5, 0.3];
    posB = [1.0, -0.2];
    angleADeg = 18;
    angleBDeg = -32;
    pinned = false;
  }

  $effect(() => {
    // track state
    posA;
    posB;
    angleADeg;
    angleBDeg;
    hxA;
    hyA;
    hxB;
    hyB;
    pinned;
    selIndex;
    if (canvas) draw();
  });
</script>

<div class="playground">
  <div class="plot">
    <canvas
      bind:this={canvas}
      aria-label="Separating axis theorem box versus box explorer"
      onpointerdown={onDown}
      onpointermove={onMove}
      onpointerup={onUp}
      onpointercancel={onUp}
    ></canvas>
  </div>

  <aside class="side">
    <div class="controls">
      <fieldset>
        <legend>box A</legend>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={angleADeg} />
          <output>{angleADeg}°</output>
        </label>
        <label>
          <span>half x</span>
          <input type="range" min="0.5" max="2.4" step="0.05" bind:value={hxA} />
          <output>{hxA.toFixed(2)}</output>
        </label>
        <label>
          <span>half y</span>
          <input type="range" min="0.4" max="1.8" step="0.05" bind:value={hyA} />
          <output>{hyA.toFixed(2)}</output>
        </label>
      </fieldset>

      <fieldset>
        <legend>box B</legend>
        <label>
          <span>angle</span>
          <input type="range" min="-90" max="90" step="1" bind:value={angleBDeg} />
          <output>{angleBDeg}°</output>
        </label>
        <label>
          <span>half x</span>
          <input type="range" min="0.5" max="2.4" step="0.05" bind:value={hxB} />
          <output>{hxB.toFixed(2)}</output>
        </label>
        <label>
          <span>half y</span>
          <input type="range" min="0.4" max="1.8" step="0.05" bind:value={hyB} />
          <output>{hyB.toFixed(2)}</output>
        </label>
      </fieldset>

      <menu>
        <li><button onclick={reset}>reset</button></li>
        <li><button onclick={() => (pinned = false)} disabled={!pinned}>follow min axis</button></li>
      </menu>
    </div>

    <fieldset>
      <legend>candidate axes</legend>
      <ul class="axis-list">
        {#each test.results as r, i}
          <li>
            <button
              type="button"
              class:is-min={i === test.minIndex}
              class:is-sep={r.overlap < 0}
              aria-current={i === selectedIndex ? "true" : undefined}
              onclick={() => {
                pinned = true;
                selIndex = i;
              }}
            >
              <span class="swatch" style:background={i < 2 ? "#2563eb" : "#f59e0b"}></span>
              <span>{r.label}</span>
              <output>{fmt(r.overlap)}</output>
            </button>
          </li>
        {/each}
      </ul>
    </fieldset>

    <fieldset class="readout">
      <legend>result</legend>
      <label>
        <span>status</span>
        <output data-mood={test.hit ? "hit" : "miss"}>{test.hit ? "overlap" : "separated"}</output>
      </label>
      <label>
        <span>normal <Tex tex="\hat n" /></span>
        <output>({test.min.axis[0].toFixed(2)}, {test.min.axis[1].toFixed(2)})</output>
      </label>
      <label>
        <span>min overlap</span>
        <output>{fmt(test.min.overlap)}</output>
      </label>
    </fieldset>
  </aside>
</div>
