<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import Surface3D from "$lib/components/calculus/Surface3D.svelte";

  // Hill f(x,y) = A * exp(-(x^2+y^2)/S) — radially symmetric, so contours are
  // circles and the tangent slopes have a closed form.
  const A = 3;
  const S = 8;
  const DOM = 6;
  const T = 1.6; // half-length of each tangent segment

  function f(x, y) {
    return A * Math.exp(-(x * x + y * y) / S);
  }
  function fx(x, y) {
    return f(x, y) * (-2 * x) / S;
  }
  function fy(x, y) {
    return f(x, y) * (-2 * y) / S;
  }

  let px = $state(2.2);
  let py = $state(1.3);

  let value = $derived(f(px, py));
  let slopeX = $derived(fx(px, py));
  let slopeY = $derived(fy(px, py));

  function fmt(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }
</script>

<div class="playground">
  <Surface3D
    fn={f}
    domain={DOM}
    resolution={32}
    zScale={1.6}
    ariaLabel="3D hill: partial derivatives"
  >
    {#snippet children({ project })}
      {@const foot = project(px, py, 0)}
      {@const top = project(px, py, value)}
      {@const sxA = project(px - T, py, value - slopeX * T)}
      {@const sxB = project(px + T, py, value + slopeX * T)}
      {@const syA = project(px, py - T, value - slopeY * T)}
      {@const syB = project(px, py + T, value + slopeY * T)}

      <!-- height guide down to the ground plane -->
      <line class="guide" x1={foot.x} y1={foot.y} x2={top.x} y2={top.y} />
      <circle class="point-b" cx={foot.x} cy={foot.y} r="5" />

      <!-- slopes: east-west (∂f/∂x) and north-south (∂f/∂y) -->
      <line class="guide-dx" x1={sxA.x} y1={sxA.y} x2={sxB.x} y2={sxB.y} />
      <line class="guide-dy" x1={syA.x} y1={syA.y} x2={syB.x} y2={syB.y} />

      <!-- point riding the surface -->
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
      <legend>slopes</legend>
      <label>
        <span>height <Tex tex="f(x,y)" /></span>
        <output>{fmt(value)}</output>
      </label>
      <label>
        <span><Tex tex="\partial f/\partial x" /> (east)</span>
        <output>{fmt(slopeX)}</output>
      </label>
      <label>
        <span><Tex tex="\partial f/\partial y" /> (north)</span>
        <output>{fmt(slopeY)}</output>
      </label>
    </fieldset>
  </aside>
</div>
