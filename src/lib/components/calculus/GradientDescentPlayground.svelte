<script>
  import Tex from "$lib/components/calculus/Tex.svelte";
  import Surface3D from "$lib/components/calculus/Surface3D.svelte";
  import { projectPath } from "$lib/playgrounds/calculus/surface.js";

  // Elongated bowl: f(x,y) = Ax*x^2 + By*y^2, By > Ax so it is steep in y and
  // shallow in x — a lopsided loss surface.
  const Ax = 0.4;
  const By = 2.2;
  const DOM = 5;
  const ZSCALE = 0.08; // display-only vertical exaggeration

  function f(x, y) {
    return Ax * x * x + By * y * y;
  }
  function grad(x, y) {
    return [2 * Ax * x, 2 * By * y];
  }

  const START = [3.6, 2.4];
  let path = $state([START]);
  let lr = $state(0.35);
  let running = $state(false);
  let timer = null;

  let current = $derived(path[path.length - 1]);
  let curVal = $derived(f(current[0], current[1]));

  function step() {
    const [x, y] = path[path.length - 1];
    const [gx, gy] = grad(x, y);
    const nx = x - lr * gx;
    const ny = y - lr * gy;
    path = [...path, [nx, ny]];
    if (path.length > 80) running = false; // safety stop
  }

  function reset() {
    running = false;
    if (timer) clearInterval(timer);
    path = [START];
  }

  function toggleRun() {
    if (running) {
      running = false;
      if (timer) clearInterval(timer);
      return;
    }
    running = true;
    timer = setInterval(() => {
      const [x, y] = path[path.length - 1];
      if (Math.hypot(x, y) < 0.05 || path.length > 80 || Math.hypot(x, y) > 30) {
        running = false;
        clearInterval(timer);
        return;
      }
      step();
    }, 220);
  }

  $effect(() => {
    return () => {
      if (timer) clearInterval(timer);
    };
  });

  // path points lifted onto the surface
  let pathWorld = $derived(path.map(([x, y]) => [x, y, f(x, y)]));

  function fmt(n) {
    return (Math.round(n * 1000) / 1000).toFixed(3);
  }
</script>

<div class="playground">
  <Surface3D fn={f} domain={DOM} resolution={32} zScale={ZSCALE} scale={20} ariaLabel="3D bowl: gradient descent">
    {#snippet children({ project })}
      {@const ball = project(current[0], current[1], f(current[0], current[1]))}
      {@const minPt = project(0, 0, 0)}

      <path class="accum" d={projectPath(pathWorld, project)} />
      <circle class="point-d" cx={minPt.x} cy={minPt.y} r="4" />
      <circle class="point-b" cx={ball.x} cy={ball.y} r="7" />
    {/snippet}
  </Surface3D>

  <aside class="side">
    <fieldset>
      <legend>learning rate</legend>
      <label>
        <span><Tex tex="\eta" /></span>
        <input type="range" min="0.02" max="0.65" step="0.01" bind:value={lr} />
        <output>{lr.toFixed(2)}</output>
      </label>
    </fieldset>

    <fieldset class="readout">
      <legend>descent</legend>
      <label>
        <span>steps</span>
        <output>{path.length - 1}</output>
      </label>
      <label>
        <span>height <Tex tex="f(x,y)" /></span>
        <output>{fmt(curVal)}</output>
      </label>
    </fieldset>

    <div class="controls">
      <button onclick={step} disabled={running}>step</button>
      <button onclick={toggleRun}>{running ? "pause" : "run"}</button>
      <button onclick={reset}>reset</button>
    </div>
  </aside>
</div>
