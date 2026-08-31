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
  const name = "dy-fn";

  let fnKey = $state("x2");
  let x = $state(0.6);
  let dx = $state(0.6);
  let zoom = $state(false);

  let ctx = $derived.by(() => {
    const f = FN_CATALOG[fnKey].f;
    return {
      f,
      tex: FN_CATALOG[fnKey].tex,
      curve: sample(f, XMIN, XMAX, 480),
    };
  });

  let view = $derived.by(() => {
    if (zoom) {
      const half = Math.max(0.6, Math.abs(dx) * 2 + 0.4);
      const c = x + dx / 2;
      const x0 = c - half;
      const x1 = c + half;
      return { xMin: x0, xMax: x1, range: fitY([ctx.f], x0, x1, 0.28) };
    }
    return { xMin: XMIN, xMax: XMAX, range: fitY([ctx.f], XMIN, XMAX, 0.22) };
  });

  let fx = $derived(ctx.f(x));
  let der = $derived(derivative(ctx.f, x));
  let dy = $derived(der * dx);
  let dyActual = $derived(ctx.f(x + dx) - fx);
  let error = $derived(dyActual - dy);

  const fmt = (n) => (Math.abs(n) < 1e-9 ? "0" : n.toFixed(4));

  function onSeek(dxv) {
    x = clamp(dxv, view.xMin, view.xMax);
  }
</script>

<div class="playground">
  <div class="plot">
    <Graph
      xMin={view.xMin}
      xMax={view.xMax}
      yMin={view.range[0]}
      yMax={view.range[1]}
      ariaLabel="Differential and linear approximation"
      {onSeek}
    >
      {#snippet children(s)}
        <path class="tangent" d={linePath(x, fx, der, view.xMin, view.xMax, s)} />
        <path class="curve" d={toPath(ctx.curve, s)} />
        <path class="guide-dx" d={segmentPath(x, fx, x + dx, fx, s)} />
        <path class="guide-dy" d={segmentPath(x + dx, fx, x + dx, fx + dy, s)} />
        <path class="guide-actual" d={segmentPath(x + dx, fx, x + dx, fx + dyActual, s)} />
        <circle class="point" cx={s.x(x)} cy={s.y(fx)} r="4" />
        <circle class="point-b" cx={s.x(x + dx)} cy={s.y(fx + dyActual)} r="4" />
        <circle class="point-d" cx={s.x(x + dx)} cy={s.y(fx + dy)} r="4" />
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
        <legend>step <Tex tex="dx" /></legend>
        <label>
          <span>dx</span>
          <input type="range" min="-1" max="1" step="0.01" bind:value={dx} />
          <output>{dx.toFixed(2)}</output>
        </label>
      </fieldset>
      <label class="checkbox">
        <input type="checkbox" bind:checked={zoom} />
        <span>Zoom in — the curve hugs its tangent line</span>
      </label>
    </div>

    <fieldset class="readout">
      <legend>values</legend>
      <label>
        <span><Tex tex="dy = f'(x)\,dx" /> (tangent rise)</span>
        <output>{fmt(dy)}</output>
      </label>
      <label>
        <span><Tex tex="\Delta y = f(x+dx)-f(x)" /> (true rise)</span>
        <output>{fmt(dyActual)}</output>
      </label>
      <label>
        <span>error <Tex tex="\Delta y - dy" /></span>
        <output>{fmt(error)}</output>
      </label>
    </fieldset>
    <p class="note">
      The differential <Tex tex="dy" /> is the rise along the tangent line; <Tex tex="\Delta y" /> is the true
      rise along the curve. For a small <Tex tex="dx" /> they nearly coincide — the tangent line is the best
      linear approximation.
    </p>
  </aside>
</div>
