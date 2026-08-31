<script>
  import Graph from "./Graph.svelte";
  import Tex from "./Tex.svelte";
  import {
    FN_CATALOG,
    clamp,
    sample,
    toPath,
    areaPath,
    riemannRects,
    integrate,
    fitY,
  } from "$lib/playgrounds/calculus/plot.js";

  const options = ["x2", "x3", "sin", "exp", "sqrt"];
  const DOMAIN = {
    x2: [-3, 3],
    x3: [-3, 3],
    sin: [-3, 3],
    exp: [-3, 3],
    sqrt: [0, 3],
  };
  const METHODS = [
    ["left", "Left"],
    ["mid", "Mid"],
    ["right", "Right"],
  ];
  const name = "rm-fn";

  let fnKey = $state("x2");
  let mode = $state("mid");
  let a = $state(-2);
  let b = $state(2);
  let n = $state(12);

  let ctx = $derived.by(() => {
    const f = FN_CATALOG[fnKey].f;
    const [x0, x1] = DOMAIN[fnKey];
    return {
      f,
      tex: FN_CATALOG[fnKey].tex,
      x0,
      x1,
      curve: sample(f, x0, x1, 480),
      range: fitY([f], x0, x1, 0.2),
    };
  });

  // keep a, b inside the current function's domain (e.g. √x lives on [0, 3])
  $effect(() => {
    const { x0, x1 } = ctx;
    a = clamp(a, x0, x1 - 0.2);
    b = clamp(b, x0 + 0.2, x1);
    if (b - a < 0.2) b = clamp(a + 0.2, x0 + 0.2, x1);
  });

  let approx = $derived(riemannRects(ctx.f, a, b, n, mode));
  let exact = $derived(integrate(ctx.f, a, b));
  let error = $derived(approx.sum - exact);
</script>

<div class="playground">
  <div class="plot">
    <Graph
      xMin={ctx.x0}
      xMax={ctx.x1}
      yMin={ctx.range[0]}
      yMax={ctx.range[1]}
      ariaLabel="Riemann sum explorer"
    >
      {#snippet children(s)}
        <path class="area" d={areaPath(ctx.curve, a, b, 0, s)} />
        {#each approx.rects as r}
          {@const xPx = s.x(r.x0)}
          {@const wPx = Math.max(s.x(r.x1) - s.x(r.x0), 0.5)}
          {#if r.h >= 0}
            <rect
              class="rect-pos"
              x={xPx}
              y={s.y(r.h)}
              width={wPx}
              height={Math.max(s.y(0) - s.y(r.h), 0.5)}
            />
          {:else}
            <rect
              class="rect-neg"
              x={xPx}
              y={s.y(0)}
              width={wPx}
              height={Math.max(s.y(r.h) - s.y(0), 0.5)}
            />
          {/if}
        {/each}
        <path class="curve" d={toPath(ctx.curve, s)} />
        <line class="bound" x1={s.x(a)} y1={s.top} x2={s.x(a)} y2={s.bottom} />
        <line class="bound" x1={s.x(b)} y1={s.top} x2={s.x(b)} y2={s.bottom} />
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
      <menu role="group" aria-label="Sampling method">
        {#each METHODS as [value, label]}
          <li><label>
            <input type="radio" name={name + "-m"} value={value} bind:group={mode} />
            {label}
          </label></li>
        {/each}
      </menu>
      <fieldset>
        <legend>limits &amp; slices</legend>
        <label>
          <span>a</span>
          <input type="range" min={ctx.x0} max={ctx.x1 - 0.2} step="0.1" bind:value={a} />
          <output>{a.toFixed(1)}</output>
        </label>
        <label>
          <span>b</span>
          <input type="range" min={ctx.x0 + 0.2} max={ctx.x1} step="0.1" bind:value={b} />
          <output>{b.toFixed(1)}</output>
        </label>
        <label>
          <span>n</span>
          <input type="range" min="1" max="60" step="1" bind:value={n} />
          <output>{n}</output>
        </label>
      </fieldset>
    </div>

    <fieldset class="readout">
      <legend>sum</legend>
      <label>
        <span>Riemann sum <Tex tex="\sum f(x_i)\,\Delta x" /></span>
        <output>{approx.sum.toFixed(4)}</output>
      </label>
      <label>
        <span>exact <Tex tex="\int_a^b f(x)\,dx" /></span>
        <output>{exact.toFixed(4)}</output>
      </label>
      <label>
        <span>difference</span>
        <output>{Math.abs(error).toFixed(4)}</output>
      </label>
    </fieldset>
    <p class="note">
      More slices (larger <Tex tex="n" />) shrink the difference. Area below the axis counts negative — that is
      why the sum can shrink even when the shaded region looks big.
    </p>
  </aside>
</div>
