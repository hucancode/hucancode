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
    fitY,
  } from "$lib/playgrounds/calculus/plot.js";

  const options = ["x2", "x3", "cubic", "sin", "exp"];
  const XMIN = -4;
  const XMAX = 4;
  const name = "df-fn";

  let fnKey = $state("x3");
  let x = $state(-0.6);

  let ctx = $derived.by(() => {
    const f = FN_CATALOG[fnKey].f;
    const fp = (t) => derivative(f, t);
    return {
      f,
      fp,
      tex: FN_CATALOG[fnKey].tex,
      curve: sample(f, XMIN, XMAX, 480),
      dcurve: sample(fp, XMIN, XMAX, 480),
      range: fitY([f, fp], XMIN, XMAX, 0.18),
    };
  });

  let fx = $derived(ctx.f(x));
  let der = $derived(derivative(ctx.f, x));
  let mood = $derived(Math.abs(der) < 1e-6 ? "flat" : der > 0 ? "rising" : "falling");
  let moodLabel = $derived(
    mood === "flat"
      ? "f' = 0 — flat spot"
      : mood === "rising"
        ? "f' > 0 — rising"
        : "f' < 0 — falling",
  );

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(4));

  function onSeek(dxv) {
    x = clamp(dxv, XMIN, XMAX);
  }
</script>

<div class="playground">
  <div class="plot">
    <Graph
      xMin={XMIN}
      xMax={XMAX}
      yMin={ctx.range[0]}
      yMax={ctx.range[1]}
      ariaLabel="The derivative as a function"
      {onSeek}
    >
      {#snippet children(s)}
        <path class="deriv" d={toPath(ctx.dcurve, s)} />
        <path class="tangent" d={linePath(x, fx, der, XMIN, XMAX, s)} />
        <path class="curve" d={toPath(ctx.curve, s)} />
        <line class="link" x1={s.x(x)} y1={s.y(fx)} x2={s.x(x)} y2={s.y(der)} />
        <circle class="point" cx={s.x(x)} cy={s.y(fx)} r="4" />
        <circle class="point-d" cx={s.x(x)} cy={s.y(der)} r="4" />
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
    </div>

    <fieldset class="readout">
      <legend>slope</legend>
      <label>
        <span>slope here <Tex tex="f'(x)" /></span>
        <output>{fmt(der)}</output>
      </label>
      <label>
        <span>behaviour</span>
        <output class="mood" data-mood={mood}>{moodLabel}</output>
      </label>
    </fieldset>
    <p class="note">
      The dashed curve is <Tex tex="f'(x)" /> — the slope of <Tex tex="f" /> at every point. Positive means
      climbing, negative means falling, zero means a flat spot. Drag and watch the slope point trace <Tex tex="f'" />.
    </p>
  </aside>
</div>
