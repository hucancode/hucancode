<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/mech.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import { generateMech, ARCHETYPES, PALETTE } from "$lib/playgrounds/mech/design/index.js";
  import { texRowOf } from "$lib/playgrounds/mech/sdf.js";

  let scene = $state(null);

  // design-engine params (what the artist controls) ------------------------
  let archetype = $state("vanguard");
  let seed = $state(1);
  let detail = $state(1.0);
  let accent = $state(PALETTE.accent);
  const ACCENTS = ["#d6552f", "#e8b730", "#3fb6d0", "#6fcf57", "#c64bd0", "#e0e0e0"];

  // HUD state
  let stage = $state(3);        // pipeline reveal: 1 base, 2 +bool, 3 +detail
  let spin = $state(0.3);
  let shadow = $state(false);
  let ground = $state(false);
  let light = $state(0.6);

  const STORE = "mech-model";
  const clone = (m) => structuredClone(m);
  let model = $state(loadModel());
  let sel = $state(0);           // selected authored node index
  let saved = $state(false), loaded = $state(false), noStore = $state(false);
  let showCode = $state(false);

  function loadModel() {
    if (browser) {
      try {
        const m = JSON.parse(localStorage.getItem(STORE));
        if (m && Array.isArray(m.nodes)) return m;
      } catch { /* fall through to a freshly generated default */ }
    }
    return generateMech({ archetype: "vanguard", seed: 1, detail: 1.0 });
  }

  // run the design engine, then hand the primitive list to the render engine
  function regen() {
    model = generateMech({ archetype, seed, detail, accent });
    sel = 0;
    scene?.apply({ resetView: true });
  }
  function reseed() {
    seed = Math.floor(Math.random() * 9999) + 1;
    regen();
  }

  const TYPES = ["box", "sphere", "cyl", "capsule", "cone", "torus", "pyramid"];
  const OPS = ["union", "subtract", "intersect"];
  const COLORS = Object.keys(PALETTE);
  const hexOf = (c) => (PALETTE[c] ?? c ?? "#8b94a6").toLowerCase();

  // which dims slots a primitive uses, and how to label them
  const DIMS_META = {
    box: [["Half-W", 0], ["Half-H", 1], ["Half-D", 2]],
    sphere: [["Radius", 0]],
    cyl: [["Radius", 0], ["Half-len", 1]],
    capsule: [["Radius", 0], ["Half-len", 1]],
    cone: [["R bottom", 0], ["Half-len", 1], ["R top", 2]],
    torus: [["Ring R", 0], ["Tube r", 1]],
    pyramid: [["Base half", 0], ["Half-height", 1]],
  };

  const node = $derived(model.nodes[sel] ?? null);
  const stageLabel = $derived(["", "1 · base shapes", "2 · + boolean ops", "3 · + micro detail"][stage]);

  // ---- push reactive state into the scene ---------------------------------
  $effect(() => { scene?.apply({ stage }); });
  $effect(() => { scene?.apply({ spin }); });
  $effect(() => { scene?.apply({ shadow: shadow ? 1 : 0 }); });
  $effect(() => { scene?.apply({ ground: ground ? 1 : 0 }); });
  $effect(() => { scene?.apply({ lightAngle: light }); });
  // re-pack the whole model on any geometry edit (deep dependency via snapshot)
  $effect(() => { scene?.apply({ model: $state.snapshot(model) }); });
  // highlight the selected authored node (account for sym row expansion)
  $effect(() => { scene?.apply({ selected: texRowOf($state.snapshot(model), sel) }); });

  // ---- node CRUD ----------------------------------------------------------
  function addNode() {
    const base = node ? clone($state.snapshot(node)) : null;
    const n = base
      ? { ...base, pos: [(base.pos?.[0] ?? 0) + 0.4, base.pos?.[1] ?? 0, base.pos?.[2] ?? 0] }
      : { type: "box", pos: [0, 0, 0], rot: [0, 0, 0], dims: [0.5, 0.5, 0.5], round: 0.06, op: "union", k: 0, color: "#8b94a6", stage };
    model.nodes = [...model.nodes, n];
    sel = model.nodes.length - 1;
  }
  function removeNode(i) {
    model.nodes = model.nodes.filter((_, j) => j !== i);
    sel = Math.max(0, Math.min(sel, model.nodes.length - 1));
  }
  function dup(i) {
    const n = clone($state.snapshot(model.nodes[i]));
    n.pos = [(n.pos?.[0] ?? 0) + 0.4, n.pos?.[1] ?? 0, n.pos?.[2] ?? 0];
    model.nodes = [...model.nodes.slice(0, i + 1), n, ...model.nodes.slice(i + 1)];
    sel = i + 1;
  }
  const setVec = (key, i, v) => {
    const a = (node[key] ?? [0, 0, 0]).slice();
    a[i] = +v; node[key] = a;
  };
  const ensureDims = (i, v) => {
    const a = (node.dims ?? []).slice();
    while (a.length <= i) a.push(0);
    a[i] = +v; node.dims = a;
  };

  function resetModel() { regen(); }

  function save() {
    if (!browser) return;
    localStorage.setItem(STORE, JSON.stringify($state.snapshot(model)));
    saved = true; setTimeout(() => (saved = false), 1200);
  }
  function load() {
    if (!browser) return;
    try {
      const m = JSON.parse(localStorage.getItem(STORE));
      if (m && Array.isArray(m.nodes)) { model = m; sel = 0; loaded = true; setTimeout(() => (loaded = false), 1200); return; }
    } catch { /* nothing valid */ }
    noStore = true; setTimeout(() => (noStore = false), 1200);
  }

  const code = $derived(JSON.stringify($state.snapshot(model), null, 1));
</script>

<svelte:head><title>Mech</title></svelte:head>

<nav><a class="back" href="/playgrounds">{@html Return} Playgrounds</a></nav>

<main>
  <section>
    <Scene bind:this={scene} />
    <div class="hud">
      <div class="row build">
        <span class="stage-label">Pipeline {stageLabel}</span>
        <input type="range" min="1" max="3" step="1" bind:value={stage} />
      </div>
      <div class="row knobs">
        <label><span>Spin</span><input type="range" min="0" max="3" step="0.1" bind:value={spin} /></label>
        <label><span>Light</span><input type="range" min="0" max="6.28" step="0.05" bind:value={light} /></label>
        <label class="chk"><input type="checkbox" bind:checked={shadow} /> Shadows</label>
        <label class="chk"><input type="checkbox" bind:checked={ground} /> Ground</label>
        <button type="button" onclick={() => scene?.apply({ resetView: true })}>Reset view</button>
      </div>
    </div>
  </section>

  <aside>
    <fieldset>
      <legend>design engine</legend>
      <label><span>Archetype</span>
        <select bind:value={archetype} onchange={regen}>
          {#each ARCHETYPES as a}<option value={a.id}>{a.name}</option>{/each}
        </select></label>
      <label><span>Detail</span>
        <input type="range" min="0.4" max="2" step="0.1" bind:value={detail} /><output>{detail.toFixed(1)}</output></label>
      <div class="grp">accent</div>
      <span class="swatches">
        {#each ACCENTS as c}
          <button type="button" class="chip" class:on={accent.toLowerCase() === c}
            style:background={c} aria-label={c} onclick={() => (accent = c)}></button>
        {/each}
      </span>
      <div class="tabs">
        <button type="button" class="go" onclick={regen}>⚙ generate</button>
        <button type="button" onclick={reseed}>🎲 seed {seed}</button>
      </div>
    </fieldset>

    <fieldset>
      <legend>storage</legend>
      <div class="tabs">
        <button type="button" onclick={save}>{saved ? "✓ saved" : "💾 save"}</button>
        <button type="button" onclick={load}>{loaded ? "✓ loaded" : noStore ? "✕ none" : "📂 load"}</button>
        <button type="button" onclick={resetModel}>↺ reset</button>
      </div>
      <button type="button" class="wide" onclick={() => (showCode = !showCode)}>{showCode ? "▲ hide code" : "▼ show code"}</button>
      {#if showCode}<textarea class="code" readonly rows="7">{code}</textarea>{/if}
    </fieldset>

    <fieldset>
      <legend>parts <button type="button" class="add" onclick={addNode}>+ node</button></legend>
      <ul class="parts">
        {#each model.nodes as n, i (i)}
          <li>
            <button type="button" class="pick" class:on={i === sel} onclick={() => (sel = i)}>
              <span class="sw" style:background={n.op === "subtract" ? "transparent" : hexOf(n.color)}
                class:cut={n.op === "subtract"}></span>
              <span class="nm">{n.type}{n.op && n.op !== "union" ? ` · ${n.op}` : ""}{n.sym ? " ⇄" : ""}</span>
              <em>s{n.stage ?? 1}</em>
            </button>
            <span class="ctl">
              <button type="button" onclick={() => dup(i)} title="duplicate">⧉</button>
              <button type="button" class="del" onclick={() => removeNode(i)}>✕</button>
            </span>
          </li>
        {/each}
      </ul>
    </fieldset>

    {#if node}
      <fieldset>
        <legend>node {sel} — {node.type}</legend>
        <label><span>Primitive</span>
          <select bind:value={node.type}>{#each TYPES as t}<option value={t}>{t}</option>{/each}</select></label>
        <label><span>CSG op</span>
          <select bind:value={node.op}>{#each OPS as o}<option value={o}>{o}</option>{/each}</select></label>
        <label><span>Pipeline step</span>
          <select bind:value={node.stage}><option value={1}>1 base</option><option value={2}>2 boolean</option><option value={3}>3 detail</option></select></label>
        <label class="chk"><input type="checkbox" bind:checked={node.sym} /> <span>Mirror L/R (X)</span></label>

        <div class="grp">dimensions</div>
        {#each DIMS_META[node.type] ?? [] as [lab, idx]}
          <label><span>{lab}</span>
            <input type="range" min="0.02" max="2" step="0.02" value={node.dims?.[idx] ?? 0}
              oninput={(e) => ensureDims(idx, e.currentTarget.value)} /><output>{(node.dims?.[idx] ?? 0).toFixed(2)}</output></label>
        {/each}
        <label><span>Bevel</span>
          <input type="range" min="0" max="0.3" step="0.005" value={node.round ?? 0}
            oninput={(e) => (node.round = +e.currentTarget.value)} /><output>{(node.round ?? 0).toFixed(3)}</output></label>
        <label><span>Smooth k</span>
          <input type="range" min="0" max="0.4" step="0.01" value={node.k ?? 0}
            oninput={(e) => (node.k = +e.currentTarget.value)} /><output>{(node.k ?? 0).toFixed(2)}</output></label>

        <div class="grp">position</div>
        {#each ["X", "Y", "Z"] as ax, i}
          <label><span>Pos {ax}</span>
            <input type="range" min="-4" max="4.5" step="0.02" value={node.pos?.[i] ?? 0}
              oninput={(e) => setVec("pos", i, e.currentTarget.value)} /><output>{(node.pos?.[i] ?? 0).toFixed(2)}</output></label>
        {/each}
        <div class="grp">rotation°</div>
        {#each ["X", "Y", "Z"] as ax, i}
          <label><span>Rot {ax}</span>
            <input type="range" min="-180" max="180" step="1" value={node.rot?.[i] ?? 0}
              oninput={(e) => setVec("rot", i, e.currentTarget.value)} /><output>{node.rot?.[i] ?? 0}</output></label>
        {/each}

        {#if node.op !== "subtract"}
          <div class="grp">color</div>
          <span class="swatches">
            {#each COLORS as c}
              <button type="button" class="chip" class:on={hexOf(node.color) === hexOf(c)}
                style:background={PALETTE[c]} title={c} aria-label={c}
                onclick={() => (node.color = PALETTE[c])}></button>
            {/each}
            <input class="picker" type="color" value={hexOf(node.color)}
              oninput={(e) => (node.color = e.currentTarget.value)} title="custom" />
          </span>
        {/if}
      </fieldset>
    {/if}
  </aside>
</main>

<style>
  main { display: grid; grid-template-columns: 1fr 20rem; height: 100dvh; }
  section { position: relative; }
  section :global(canvas) { width: 100%; height: 100%; display: block; }
  .hud {
    position: absolute; left: 0; right: 0; bottom: 0;
    display: flex; flex-direction: column; gap: 0.4rem;
    padding: 0.6rem 0.8rem 0.7rem;
    background: linear-gradient(to top, color-mix(in srgb, #000 60%, transparent), transparent);
    font-size: 0.75rem; pointer-events: none;
  }
  .hud .row { display: flex; align-items: center; gap: 0.6rem; pointer-events: auto; }
  .stage-label { white-space: nowrap; font-weight: 600; min-width: 11rem; }
  .hud .build input[type="range"] { flex: 1; }
  .hud .knobs { flex-wrap: wrap; }
  .hud .knobs label { display: flex; align-items: center; gap: 0.35rem; }
  .hud .knobs label span { opacity: 0.8; }
  .chk { white-space: nowrap; }
  nav { position: absolute; z-index: 2; padding: 0.6rem 0.9rem; }
  .back { display: inline-flex; align-items: center; gap: 0.3rem; opacity: 0.85; }

  aside { overflow-y: auto; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.7rem;
    background: color-mix(in srgb, var(--paper, #14171c) 92%, #000); }
  fieldset { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 0.5rem; padding: 0.6rem; }
  legend { padding: 0 0.3rem; font-weight: 600; opacity: 0.85; }
  label { display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; margin: 0.2rem 0; }
  label > span:first-child { min-width: 5rem; opacity: 0.8; }
  label input[type="range"] { flex: 1; }
  output { min-width: 2.6rem; text-align: right; opacity: 0.8; font-variant-numeric: tabular-nums; }
  select, .tpl { width: 100%; }
  .grp { margin: 0.5rem 0 0.1rem; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; }
  .tabs { display: flex; gap: 0.25rem; margin-top: 0.4rem; }
  .tabs button { flex: 1; }
  .go { font-weight: 600; }
  .wide { width: 100%; margin-top: 0.4rem; }
  .add { font-size: 0.75rem; opacity: 0.75; margin-left: 0.4rem; }
  .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.12rem; max-height: 16rem; overflow-y: auto; }
  .parts li { display: flex; align-items: center; gap: 0.2rem; }
  .pick { flex: 1; display: flex; align-items: center; gap: 0.4rem; text-align: left; opacity: 0.7; padding: 0.18rem 0.35rem; border-radius: 0.3rem; }
  .pick.on { opacity: 1; font-weight: 600; outline: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
  .pick .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pick em { font-style: normal; font-size: 0.6rem; opacity: 0.55; }
  .sw { width: 0.85rem; height: 0.85rem; border-radius: 0.2rem; border: 1px solid color-mix(in srgb, currentColor 35%, transparent); flex: none; }
  .sw.cut { border-style: dashed; background: repeating-linear-gradient(45deg, transparent, transparent 2px, currentColor 2px, currentColor 3px); opacity: 0.6; }
  .ctl { display: flex; gap: 0.1rem; }
  .ctl button { padding: 0 0.35rem; opacity: 0.6; }
  .del:hover { color: #e0563a; opacity: 1; }
  .swatches { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .chip { width: 1.4rem; height: 1.4rem; border-radius: 0.3rem; border: 2px solid transparent; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent); cursor: pointer; padding: 0; }
  .chip.on { border-color: currentColor; }
  .picker { width: 1.6rem; height: 1.4rem; padding: 0; cursor: pointer; }
  .code { width: 100%; font-family: monospace; font-size: 0.66rem; margin-top: 0.4rem; white-space: pre; overflow: auto; }
</style>
