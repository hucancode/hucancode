<script>
  import Graph from "./Graph.svelte";
  import Tex from "./Tex.svelte";
  import {
    FN_CATALOG,
    clamp,
    sample,
    toPath,
    areaPath,
    accumulation,
    valueAt,
    linePath,
    fitY,
  } from "$lib/playgrounds/calculus/plot.js";

  const options = ["x2", "x3", "sin", "exp"];
  const XMIN = -4;
  const XMAX = 4;
  const A = XMIN;
  const name = "ftc-fn";

  let fnKey = $state("x2");
  let b = $state(1.5);

  let ctx = $derived.by(() => {
    const f = FN_CATALOG[fnKey].f;
    const Fpts = accumulation(f, A, XMAX, 600);
    return {
      f,
      tex: FN_CATALOG[fnKey].tex,
      curve: sample(f, A, XMAX, 480),
      Fpts,
      range: fitY([f, Fpts], A, XMAX, 0.2),
    };
  });

  let Fb = $derived(valueAt(ctx.Fpts, b));
  let fb = $derived(ctx.f(b));

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(4));

  function onSeek(dxv) {
    b = clamp(dxv, A + 0.1, XMAX);
  }
</script>

<div class="playground">
  <div class="plot">
    <Graph
      xMin={XMIN}
      xMax={XMAX}
      yMin={ctx.range[0]}
      yMax={ctx.range[1]}
      ariaLabel="Fundamental theorem of calculus"
      {onSeek}
    >
      {#snippet children(s)}
        <path class="area" d={areaPath(ctx.curve, A, b, 0, s)} />
        <path class="accum" d={toPath(ctx.Fpts, s)} />
        <path class="curve" d={toPath(ctx.curve, s)} />
        <path class="tangent" d={linePath(b, Fb, fb, XMIN, XMAX, s)} />
        <line class="bound" x1={s.x(b)} y1={s.top} x2={s.x(b)} y2={s.bottom} />
        <circle class="point" cx={s.x(b)} cy={s.y(fb)} r="4" />
        <circle class="point-d" cx={s.x(b)} cy={s.y(Fb)} r="4" />
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
        <legend>upper limit <Tex tex="b" /></legend>
        <label>
          <span>b</span>
          <input type="range" min={A + 0.1} max={XMAX} step="0.05" bind:value={b} />
          <output>{b.toFixed(2)}</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>area</legend>
      <label>
        <span>area under curve <Tex tex="F(b)=\int_a^b f(x)\,dx" /></span>
        <output>{fmt(Fb)}</output>
      </label>
      <label>
        <span>height of <Tex tex="f" /> at <Tex tex="b" /></span>
        <output>{fmt(fb)}</output>
      </label>
    </fieldset>
  </aside>
</div>
