<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import Surface3D from "$lib/components/calculus/Surface3D.svelte";
  import { arrowHeadPath, projectPath } from "$lib/playgrounds/calculus/surface.js";

  const A = 3;
  const S = 8;
  const DOM = 6;

  function f(x, y) {
    return A * Math.exp(-(x * x + y * y) / S);
  }
  function fx(x, y) {
    return f(x, y) * (-2 * x) / S;
  }
  function fy(x, y) {
    return f(x, y) * (-2 * y) / S;
  }

  let px = $state(2.4);
  let py = $state(1.0);

  let value = $derived(f(px, py));
  let gx = $derived(fx(px, py));
  let gy = $derived(fy(px, py));
  let mag = $derived(Math.hypot(gx, gy));

  // unit vectors: u = steepest ascent, v = flat (tangent to the level curve)
  let ux = $derived(mag > 1e-6 ? gx / mag : 0);
  let uy = $derived(mag > 1e-6 ? gy / mag : 0);
  let vx = $derived(-uy);
  let vy = $derived(ux);

  const L = 2.0; // gradient arrow length
  const F = 1.6; // flat-direction half-length

  // level curve through the point, lifted onto the surface at height value
  let ring = $derived.by(() => {
    const r0 = Math.hypot(px, py);
    const pts = [];
    const n = 80;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      pts.push([r0 * Math.cos(t), r0 * Math.sin(t), value]);
    }
    return pts;
  });

  function fmt(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
</script>

<div class="playground">
  <Surface3D fn={f} domain={DOM} resolution={32} zScale={1.6} ariaLabel="3D hill: gradient">
    {#snippet children({ project })}
      {@const foot = project(px, py, 0)}
      {@const top = project(px, py, value)}
      {@const gradEnd = project(px + ux * L, py + uy * L, 0)}
      {@const flatA = project(px - vx * F, py - vy * F, 0)}
      {@const flatB = project(px + vx * F, py + vy * F, 0)}

      <!-- height guide -->
      <line class="guide" x1={foot.x} y1={foot.y} x2={top.x} y2={top.y} />

      <!-- level curve through the point -->
      <path class="contour3d" d={projectPath(ring, project)} />

      <!-- flat direction: no change in height -->
      <line class="secant" x1={flatA.x} y1={flatA.y} x2={flatB.x} y2={flatB.y} />

      <!-- gradient: steepest ascent (in the ground plane) -->
      <line class="tangent" x1={foot.x} y1={foot.y} x2={gradEnd.x} y2={gradEnd.y} />
      <path class="grad-head" d={arrowHeadPath(foot.x, foot.y, gradEnd.x, gradEnd.y)} />

      <!-- footprint + surface point -->
      <circle class="point-b" cx={foot.x} cy={foot.y} r="5" />
      <circle class="point" cx={top.x} cy={top.y} r="5" />
    {/snippet}
  </Surface3D>

  <aside class="side">
    <fieldset>
      <legend>position</legend>
      <label>
        <span><Tex tex="x" /></span>
        <input type="range" min="-5.8" max="5.8" step="0.05" bind:value={px} />
        <output>{px.toFixed(2)}</output>
      </label>
      <label>
        <span><Tex tex="y" /></span>
        <input type="range" min="-5.8" max="5.8" step="0.05" bind:value={py} />
        <output>{py.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset class="readout">
      <legend>gradient</legend>
      <label>
        <span><Tex tex="|\nabla f|" /> (steepness)</span>
        <output>{fmt(mag)}</output>
      </label>
      <label>
        <span><Tex tex="\partial f/\partial x" /></span>
        <output>{fmt(gx)}</output>
      </label>
      <label>
        <span><Tex tex="\partial f/\partial y" /></span>
        <output>{fmt(gy)}</output>
      </label>
    </fieldset>
  </aside>
</div>
