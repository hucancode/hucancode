<script>
  import Scene from "$lib/components/lego.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import { PALETTE } from "$lib/playgrounds/lego/eagle.js";

  let scene = $state(null);
  let view = $state("assemble"); // "assemble" | "inspect"

  // assemble controls
  let spin = $state(0.0);
  let explode = $state(0);
  let progress = $state(1);
  let manual = $state(false);

  const COLORS = Object.keys(PALETTE);
  const FACES = ["y+", "y-", "x+", "x-", "z+", "z-"];

  // inspect: live op-model brick definition
  let W = $state(2), H = $state(3), D = $state(3);
  let color = $state("YE");

  // editable list of build operations, applied top-to-bottom
  const DEFAULTS = {
    slope: () => ({ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }),
    push: () => ({ op: "push", face: "z+", depth: 1, width: 1, height: 1, at: [0, 0] }),
    studs: () => ({ op: "studs", face: "y+", kind: "male", region: "all", i: 0, k: 0 }),
  };

  // a plain cuboid brick: studs up, clutch tubes down. all shaping is done by
  // adding more ops to this list.
  let ops = $state([
    { op: "studs", face: "y+", kind: "male", region: "all", i: 0, k: 0 },
    { op: "studs", face: "y-", kind: "female", region: "all", i: 0, k: 0 },
  ]);

  // normalize editable ops back into the solid op model
  function studAt(o) {
    if (o.region === "row") return { row: o.k };
    if (o.region === "col") return { col: o.i };
    if (o.region === "cell") return { cell: [o.i, o.k] };
    return undefined;
  }
  const def = $derived.by(() => ({
    size: [W, H, D],
    ops: ops.map((o) =>
      o.op === "studs"
        ? { op: "studs", face: o.face, kind: o.kind, at: studAt(o) }
        : { ...o }),
    color,
  }));

  const addOp = (t) => { ops = [...ops, DEFAULTS[t]()]; };
  const removeOp = (idx) => { ops = ops.filter((_, i) => i !== idx); };
  const moveOp = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= ops.length) return;
    const next = ops.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    ops = next;
  };

  $effect(() => { scene?.apply({ mode: view }); });
  $effect(() => { scene?.apply({ spin, explode }); });
  $effect(() => { if (view === "assemble" && manual) scene?.apply({ progress }); });
  $effect(() => { if (view === "inspect") scene?.apply({ spec: { ...def } }); });

  function replay() {
    manual = false;
    scene?.apply({ replay: true });
  }
</script>

<svelte:head>
  <title>Lego Eagle</title>
</svelte:head>

<nav><a class="back" href="/playgrounds">{@html Return} Playgrounds</a></nav>

<main>
  <section>
    <Scene bind:this={scene} />
  </section>

  <aside>
    <fieldset>
      <legend>mode</legend>
      <div class="tabs">
        <button type="button" class:on={view === "assemble"} onclick={() => (view = "assemble")}>Assemble</button>
        <button type="button" class:on={view === "inspect"} onclick={() => (view = "inspect")}>Inspect</button>
      </div>
    </fieldset>

    {#if view === "assemble"}
      <fieldset>
        <legend>build</legend>
        <button type="button" onclick={replay}>▶ Assemble</button>
        <label>
          <span>Step</span>
          <input type="range" min="0" max="1" step="0.01" bind:value={progress}
            oninput={() => (manual = true)} />
          <output>{Math.round(progress * 100)}%</output>
        </label>
      </fieldset>

      <fieldset>
        <legend>view</legend>
        <label>
          <span>Spin</span>
          <input type="range" min="0" max="3" step="0.1" bind:value={spin} />
          <output>{spin.toFixed(1)}</output>
        </label>
        <label>
          <span>Explode</span>
          <input type="range" min="0" max="2" step="0.05" bind:value={explode} />
          <output>{explode.toFixed(2)}</output>
        </label>
      </fieldset>
    {:else}
      <fieldset>
        <legend>base cuboid</legend>
        <label>
          <span>Width X</span>
          <input type="range" min="1" max="8" step="1" bind:value={W} />
          <output>{W}</output>
        </label>
        <label>
          <span>Height Y</span>
          <input type="range" min="1" max="9" step="1" bind:value={H} />
          <output>{H}</output>
        </label>
        <label>
          <span>Depth Z</span>
          <input type="range" min="1" max="8" step="1" bind:value={D} />
          <output>{D}</output>
        </label>
        <label>
          <span>Color</span>
          <select bind:value={color}>
            {#each COLORS as c}<option value={c}>{c}</option>{/each}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>operations</legend>
        <div class="tabs">
          <button type="button" onclick={() => addOp("slope")}>+ slope</button>
          <button type="button" onclick={() => addOp("push")}>+ push</button>
          <button type="button" onclick={() => addOp("studs")}>+ studs</button>
        </div>

        {#each ops as o, idx (o)}
          <div class="op">
            <header>
              <strong>{idx + 1}. {o.op}</strong>
              <span class="ctl">
                <button type="button" onclick={() => moveOp(idx, -1)} disabled={idx === 0}>↑</button>
                <button type="button" onclick={() => moveOp(idx, 1)} disabled={idx === ops.length - 1}>↓</button>
                <button type="button" onclick={() => removeOp(idx)}>✕</button>
              </span>
            </header>

            {#if o.op === "slope"}
              <label><span>Face</span>
                <select bind:value={o.face}>{#each FACES as f}<option value={f}>{f}</option>{/each}</select></label>
              <label><span>Dir</span>
                <select bind:value={o.dir}><option value={1}>forward</option><option value={-1}>backward</option></select></label>
              <label><span>Length</span>
                <input type="range" min="1" max="8" step="1" bind:value={o.length} /><output>{o.length}</output></label>
              <label><span>Depth</span>
                <input type="range" min="1" max="9" step="1" bind:value={o.depth} /><output>{o.depth}</output></label>
              <label><span>Curve</span><input type="checkbox" bind:checked={o.round} /></label>

            {:else if o.op === "push"}
              <label><span>Face</span>
                <select bind:value={o.face}>{#each FACES as f}<option value={f}>{f}</option>{/each}</select></label>
              <label><span>Depth</span>
                <input type="range" min="1" max="8" step="1" bind:value={o.depth} /><output>{o.depth}</output></label>
              <label><span>Width</span>
                <input type="range" min="1" max="8" step="1" bind:value={o.width} /><output>{o.width}</output></label>
              <label><span>Height</span>
                <input type="range" min="1" max="9" step="1" bind:value={o.height} /><output>{o.height}</output></label>
              <label><span>At U</span>
                <input type="range" min="0" max="7" step="1" bind:value={o.at[0]} /><output>{o.at[0]}</output></label>
              <label><span>At V</span>
                <input type="range" min="0" max="8" step="1" bind:value={o.at[1]} /><output>{o.at[1]}</output></label>

            {:else if o.op === "studs"}
              <label><span>Face</span>
                <select bind:value={o.face}>{#each FACES as f}<option value={f}>{f}</option>{/each}</select></label>
              <label><span>Kind</span>
                <select bind:value={o.kind}><option value="male">male</option><option value="female">female</option></select></label>
              <label><span>Region</span>
                <select bind:value={o.region}>
                  <option value="all">all</option><option value="row">row</option>
                  <option value="col">col</option><option value="cell">cell</option>
                </select></label>
              {#if o.region === "col" || o.region === "cell"}
                <label><span>i (X)</span>
                  <input type="range" min="0" max="7" step="1" bind:value={o.i} /><output>{o.i}</output></label>
              {/if}
              {#if o.region === "row" || o.region === "cell"}
                <label><span>k (Z)</span>
                  <input type="range" min="0" max="7" step="1" bind:value={o.k} /><output>{o.k}</output></label>
              {/if}
            {/if}
          </div>
        {/each}
      </fieldset>
    {/if}
  </aside>
</main>

<style>
  .tabs { display: flex; gap: 0.25rem; }
  .tabs button { flex: 1; opacity: 0.55; }
  .tabs button.on { opacity: 1; font-weight: 600; }
  .op { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 0.4rem; padding: 0.4rem 0.5rem; margin-top: 0.4rem; }
  .op header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
  .op .ctl { display: flex; gap: 0.15rem; }
  .op .ctl button { padding: 0 0.4rem; opacity: 0.7; }
  .op .ctl button:disabled { opacity: 0.25; }
</style>
