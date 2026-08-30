<script>
  import Graph from "./Graph.svelte";
  import Tex from "./Tex.svelte";
  import {
    FN_CATALOG,
    clamp,
    derivative,
    sample,
    toPath,
    linePath,
    segmentPath,
    fitY,
  } from "$lib/playgrounds/calculus/plot.js";

  const options = ["x2", "x3", "cubic", "sin", "exp"];
  const XMIN = -4;
  const XMAX = 4;
  const name = "tg-fn";

  let fnKey = $state("x2");
  let x = $state(1.1);
  let h = $state(1.0);

  let ctx = $derived.by(() => {
    const f = FN_CATALOG[fnKey].f;
    return {
      f,
      tex: FN_CATALOG[fnKey].tex,
      curve: sample(f, XMIN, XMAX, 480),
      range: fitY([f], XMIN, XMAX, 0.25),
    };
  });

  let fx = $derived(ctx.f(x));
  let fxh = $derived(ctx.f(x + h));
  let secSlope = $derived((fxh - fx) / h);
  let der = $derived(derivative(ctx.f, x));

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(4));

  function onSeek(dxv) {
    x = clamp(dxv, XMIN, XMAX - Math.max(h, 0.02));
  }
</script>

<div class="playground">
  <div class="plot">
    <Graph
      xMin={XMIN}
      xMax={XMAX}
      yMin={ctx.range[0]}
      yMax={ctx.range[1]}
      ariaLabel="Secant and tangent line explorer"
      {onSeek}
    >
      {#snippet children(s)}
        <path class="tangent" d={linePath(x, fx, der, XMIN, XMAX, s)} />
        {#if h > 0.02}
          <path class="secant" d={linePath(x, fx, secSlope, XMIN, XMAX, s)} />
        {/if}
        <path class="curve" d={toPath(ctx.curve, s)} />
        {#if h > 0.02}
          <path class="guide" d={segmentPath(x, fx, x + h, fx, s)} />
          <path class="guide" d={segmentPath(x + h, fx, x + h, fxh, s)} />
        {/if}
        <circle class="point" cx={s.x(x)} cy={s.y(fx)} r="4" />
        {#if h > 0.02}
          <circle class="point-b" cx={s.x(x + h)} cy={s.y(fxh)} r="4" />
        {/if}
      {/snippet}
    </Graph>
  </div>

  <aside class="side">
    <div class="controls">
      <menu role="group" aria-label="Function">
        {#each options as key}
          <li><label>
            <input type="radio" name={name} value={key} bind:group={fnKey} />
            <Tex tex={FN_CATALOG[key].tex} />
          </label></li>
        {/each}
      </menu>
      <fieldset>
        <legend>gap <Tex tex="h" /></legend>
        <label>
          <span>h</span>
          <input type="range" min="0.02" max="2.5" step="0.01" bind:value={h} />
          <output>{h.toFixed(2)}</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>slopes</legend>
      <label>
        <span>secant slope <Tex tex="\frac&#123;f(x+h)-f(x)&#125;&#123;h&#125;" /></span>
        <output>{fmt(secSlope)}</output>
      </label>
      <label>
        <span>tangent slope <Tex tex="f'(x)" /></span>
        <output>{fmt(der)}</output>
      </label>
    </fieldset>
    <p class="note">
      Drag the dot on the curve, then slide <Tex tex="h" /> down toward zero. The secant line turns into the
      tangent line — the derivative is the limit of average slopes.
    </p>
  </aside>
</div>
