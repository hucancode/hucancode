<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/lego.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import { PALETTE, MODEL } from "$lib/playgrounds/lego/eagle.js";
  import { cycleEdges } from "$lib/playgrounds/lego/assembly.js";
  import { STICKS } from "$lib/playgrounds/lego/solid.js";

  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const endCount = (spec) => STICKS[spec.stick]?.ends ?? 0;

  let scene = $state(null);
  let view = $state("assemble"); // "assemble" | "inspect"

  // assemble controls
  let spin = $state(0.4);
  let explode = $state(0);
  let progress = $state(1);
  let manual = $state(false);

  const COLORS = Object.keys(PALETTE);
  // colors are stored as real hex; PALETTE keys are presets resolved to hex.
  const hexOf = (c) => (PALETTE[c] ?? c ?? "#888888").toLowerCase();
  const FACES = ["y+", "y-", "x+", "x-", "z+", "z-"];
  const MOUNTS = ["top", "bottom", "front", "back", "left", "right"];

  // ---- live MODEL graph (op-model parts + connections) --------------------
  const SLOT_COUNT = 5;
  const LEGACY_KEY = "lego-eagle-model";       // old single-slot store
  const slotKey = (i) => `lego-eagle-slot-${i}`;
  // op-model = every part has size[] + ops[]; reject stale/legacy stores
  function isOpModel(m) {
    return m && m.parts && Object.values(m.parts).every(
      (p) => Array.isArray(p.size) && Array.isArray(p.ops));
  }
  // slot entry = { model, at }; returns entry or null
  function readEntry(i) {
    if (!browser) return null;
    try {
      const e = JSON.parse(localStorage.getItem(slotKey(i)));
      if (e && isOpModel(e.model)) return e;
    } catch { /* corrupt slot -> empty */ }
    return null;
  }
  function slotMeta() {
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const e = readEntry(i);
      return { filled: !!e, at: e?.at ?? null };
    });
  }
  // initial: slot 0, else migrate legacy single store, else default
  function loadModel() {
    const e = readEntry(0);
    if (e) return e.model;
    if (browser) {
      try {
        const m = JSON.parse(localStorage.getItem(LEGACY_KEY));
        if (isOpModel(m)) return m;
      } catch { /* corrupt store -> default */ }
    }
    return structuredClone(MODEL);
  }
  let model = $state(loadModel());
  let slot = $state(0);             // active save slot index
  let slots = $state(slotMeta());   // per-slot { filled, at }
  let sel = $state(Object.keys(loadModel().parts)[0] ?? "");
  let iso = $state(true);           // isolate: show only the selected part (default on)
  let connIso = $state(false);      // isolate: show only the selected connection's 2 parts
  let showCode = $state(false);     // code textarea hidden by default
  let saved = $state(false);
  let loaded = $state(false);
  let noStore = $state(false);    // load attempted but nothing valid saved
  let selConn = $state(null);       // selected connection (object ref)

  const partIds = $derived(Object.keys(model.parts));
  // roots = parts that never appear as a connection's `b` (no parent)
  const badConns = $derived(cycleEdges(model));   // cycle-forming link indices
  const childIds = $derived(new Set(
    model.connections.filter((_, i) => !badConns.has(i)).map((c) => c.b)));
  const isRoot = (id) => !childIds.has(id);

  // ---- part ops editing ---------------------------------------------------
  const OP_DEFAULTS = {
    slope: () => ({ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }),
    push: () => ({ op: "push", face: "z+", depth: 1, width: 1, height: 1, at: [0, 0] }),
    studs: () => ({ op: "studs", face: "y+", kind: "male" }),
    ball: () => ({ op: "ball", face: "y+", kind: "male", at: { cell: [0, 0] } }),
    hinge: () => ({ op: "hinge", face: "y+", kind: "male", at: { cell: [0, 0] } }),
  };
  const opAdd = (spec, t) => {
    // on a stick, connectors target an `end` index instead of a box face
    const op = spec.stick ? { op: t, end: 0, kind: "male" } : OP_DEFAULTS[t]();
    spec.ops = [...spec.ops, op];
  };
  const opRemove = (spec, i) => { spec.ops = spec.ops.filter((_, j) => j !== i); };
  const opMove = (spec, i, d) => {
    const j = i + d;
    if (j < 0 || j >= spec.ops.length) return;
    const next = spec.ops.slice();
    [next[i], next[j]] = [next[j], next[i]];
    spec.ops = next;
  };
  function studRegion(o) {
    if (!o.at) return "all";
    if ("row" in o.at) return "row";
    if ("col" in o.at) return "col";
    if ("cell" in o.at) return "cell";
    return "all";
  }
  function setStudRegion(o, r) {
    if (r === "all") o.at = undefined;
    else if (r === "row") o.at = { row: 0 };
    else if (r === "col") o.at = { col: 0 };
    else o.at = { cell: [0, 0] };
  }

  // ---- parts CRUD ---------------------------------------------------------
  function addPart() {
    let n = 1, id = "part1";
    while (model.parts[id]) id = `part${++n}`;
    model.parts[id] = {
      size: [2, 3, 3],
      ops: [{ op: "studs", face: "y+" }, { op: "studs", face: "y-", kind: "female" }],
      color: COLORS[0],
    };
    sel = id;
  }
  // I/Y/T connector stick: a part with branching rods; one male stud per end.
  function addStick(type) {
    let n = 1, id = `${type.toLowerCase()}stick1`;
    while (model.parts[id]) id = `${type.toLowerCase()}stick${++n}`;
    model.parts[id] = {
      stick: type,
      size: STICKS[type].size.slice(),
      ops: range(STICKS[type].ends).map((i) => ({ op: "studs", end: i, kind: "male" })),
      color: COLORS[0],
    };
    sel = id;
  }
  function removePart(id) {
    const { [id]: _, ...rest } = model.parts;
    model.parts = rest;
    model.connections = model.connections.filter((c) => c.a !== id && c.b !== id);
    if (model.root === id) model.root = partIds[0] ?? "";
    if (sel === id) sel = partIds[0] ?? "";
  }
  function renamePart(oldId, newId) {
    newId = newId.trim();
    if (!newId || newId === oldId || model.parts[newId]) return;
    model.parts = Object.fromEntries(
      Object.entries(model.parts).map(([k, v]) => [k === oldId ? newId : k, v]),
    );
    for (const c of model.connections) {
      if (c.a === oldId) c.a = newId;
      if (c.b === oldId) c.b = newId;
    }
    if (model.root === oldId) model.root = newId;
    if (sel === oldId) sel = newId;
  }

  // ---- connections CRUD ---------------------------------------------------
  function addConn() {
    const c = { a: model.root, b: partIds[0] ?? "", on: "top", off: [0, 0], rot: [0, 0, 0] };
    model.connections = [...model.connections, c];
    selConn = c;
  }
  const removeConn = (idx) => {
    const c = model.connections[idx];
    model.connections = model.connections.filter((_, i) => i !== idx);
    if (selConn === c) selConn = model.connections[0] ?? null;
  };
  const moveConn = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= model.connections.length) return;
    const next = model.connections.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    model.connections = next;
  };

  // connection rotation: [x,y,z] degrees, each a multiple of 90.
  // legacy single `angle` reads as the Y component.
  const connRot = (c) => c.rot ?? [0, c.angle ?? 0, 0];
  function setConnRot(c, i, v) {
    const r = connRot(c).slice();
    r[i] = +v;
    c.rot = r;
    delete c.angle;            // drop legacy field once edited
  }
  // offsets snap to whole studs
  const setOff = (c, i, v) => {
    const o = [c.off?.[0] ?? 0, c.off?.[1] ?? 0];
    o[i] = Math.round(+v);
    c.off = o;
  };

  // joint articulation: ball = free jrot[u,v,n]°, hinge = jangle° on one axis
  const JOINTS = ["none", "ball", "hinge"];
  const HINGE_AXES = ["u", "v", "n"];
  function setJoint(c, kind) {
    if (kind === "ball") { c.joint = "ball"; c.jrot = c.jrot ?? [0, 0, 0]; delete c.jangle; delete c.axis; }
    else if (kind === "hinge") { c.joint = "hinge"; c.jangle = c.jangle ?? 0; c.axis = c.axis ?? "u"; delete c.jrot; }
    else { delete c.joint; delete c.jrot; delete c.jangle; delete c.axis; }
  }
  const jrotOf = (c) => c.jrot ?? [0, 0, 0];
  function setJrot(c, i, v) {
    const r = jrotOf(c).slice();
    r[i] = +v;
    c.jrot = r;
  }

  function resetModel() {
    model = structuredClone(MODEL);
    sel = partIds[0] ?? "";
    selConn = model.connections[0] ?? null;
  }

  // ---- serialize MODEL back to source ------------------------------------
  function js(v) {
    if (v === undefined) return "undefined";
    if (Array.isArray(v)) return "[" + v.map(js).join(", ") + "]";
    if (v && typeof v === "object")
      return "{ " + Object.entries(v).filter(([, x]) => x !== undefined)
        .map(([k, x]) => `${k}: ${js(x)}`).join(", ") + " }";
    if (typeof v === "string") return JSON.stringify(v);
    return String(v);
  }
  function serializeModel(m) {
    const parts = Object.entries(m.parts)
      .map(([id, s]) => `    ${id}: ${js(s)},`).join("\n");
    const conns = m.connections
      .map((c) => `    ${js(c)},`).join("\n");
    return `export const MODEL = {\n  parts: {\n${parts}\n  },\n  root: ${js(m.root)},\n  baseY: ${js(m.baseY ?? 0)},\n  connections: [\n${conns}\n  ],\n};`;
  }
  const code = $derived(serializeModel($state.snapshot(model)));

  // ---- scene wiring -------------------------------------------------------
  $effect(() => { scene?.apply({ spin, explode }); });
  $effect(() => { if (view === "assemble" && manual) scene?.apply({ progress }); });
  // a 2-part model holding just the selected connection (rooted at its anchor)
  function pairModel() {
    const c = selConn ?? model.connections[0];
    if (!c || !model.parts[c.a] || !model.parts[c.b]) return null;
    return {
      parts: { [c.a]: $state.snapshot(model.parts[c.a]), [c.b]: $state.snapshot(model.parts[c.b]) },
      root: c.a, baseY: 0, connections: [$state.snapshot(c)],
    };
  }
  $effect(() => {
    // isolate options (inspect tab): one part, or one connection's two parts;
    // otherwise the full assembly, re-resolved live so edits preview in either tab.
    const pair = connIso ? pairModel() : null;        // connection isolate (assemble tab)
    if (view === "inspect" && iso && model.parts[sel])
      scene?.apply({ mode: "inspect", spec: $state.snapshot(model.parts[sel]) });
    else if (pair)
      scene?.apply({ mode: "assemble", model: pair });
    else
      scene?.apply({ mode: "assemble", model: $state.snapshot(model) });
  });
  // explicit save / load per slot (no autosave)
  function saveModel() {
    if (!browser) return;
    const entry = { model: $state.snapshot(model), at: new Date().toISOString() };
    localStorage.setItem(slotKey(slot), JSON.stringify(entry));
    slots = slotMeta();
    saved = true; setTimeout(() => (saved = false), 1200);
  }
  function loadFromStore() {
    const e = readEntry(slot);
    if (!e) { noStore = true; setTimeout(() => (noStore = false), 1200); return; }
    model = e.model;
    sel = Object.keys(e.model.parts)[0] ?? "";
    selConn = e.model.connections?.[0] ?? null;
    loaded = true; setTimeout(() => (loaded = false), 1200);
  }
  function clearSlot() {
    if (!browser) return;
    localStorage.removeItem(slotKey(slot));
    slots = slotMeta();
  }
  const slotLabel = (at) => at ? new Date(at).toLocaleString() : "empty";

  function replay() {
    manual = false;
    scene?.apply({ replay: true });
  }
</script>

<svelte:head>
  <title>Lego</title>
</svelte:head>

<nav><a class="back" href="/playgrounds">{@html Return} Playgrounds</a></nav>

{#snippet opsEditor(spec)}
  {#if !spec.stick}
    <div class="tabs">
      <button type="button" onclick={() => opAdd(spec, "slope")}>+ slope</button>
      <button type="button" onclick={() => opAdd(spec, "push")}>+ push</button>
      <button type="button" onclick={() => opAdd(spec, "studs")}>+ studs</button>
    </div>
  {/if}
  <div class="tabs">
    {#if spec.stick}<button type="button" onclick={() => opAdd(spec, "studs")}>+ studs</button>{/if}
    <button type="button" onclick={() => opAdd(spec, "ball")}>+ ball</button>
    <button type="button" onclick={() => opAdd(spec, "hinge")}>+ hinge</button>
  </div>
  {#each spec.ops as o, idx (o)}
    <div class="op">
      <header>
        <strong>{idx + 1}. {o.op}</strong>
        <span class="ctl">
          <button type="button" onclick={() => opMove(spec, idx, -1)} disabled={idx === 0}>▲</button>
          <button type="button" onclick={() => opMove(spec, idx, 1)} disabled={idx === spec.ops.length - 1}>▼</button>
          <button type="button" onclick={() => opRemove(spec, idx)}>✕</button>
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

      {:else if (o.op === "studs" || o.op === "ball" || o.op === "hinge") && spec.stick}
        <label><span>End</span>
          <select bind:value={o.end}>{#each range(endCount(spec)) as i}<option value={i}>{i}</option>{/each}</select></label>
        <span class="ctl">male end</span>

      {:else if o.op === "studs" || o.op === "ball" || o.op === "hinge"}
        <label><span>Face</span>
          <select bind:value={o.face}>{#each FACES as f}<option value={f}>{f}</option>{/each}</select></label>
        <label><span>Kind</span>
          <select bind:value={o.kind}><option value="male">male</option><option value="female">female</option></select></label>
        <label><span>Region</span>
          <select value={studRegion(o)} onchange={(e) => setStudRegion(o, e.currentTarget.value)}>
            <option value="all">all</option><option value="row">row</option>
            <option value="col">col</option><option value="cell">cell</option>
          </select></label>
        {#if studRegion(o) === "row"}
          <label><span>k (Z)</span>
            <input type="range" min="0" max="7" step="1" bind:value={o.at.row} /><output>{o.at.row}</output></label>
        {:else if studRegion(o) === "col"}
          <label><span>i (X)</span>
            <input type="range" min="0" max="7" step="1" bind:value={o.at.col} /><output>{o.at.col}</output></label>
        {:else if studRegion(o) === "cell"}
          <label><span>i (X)</span>
            <input type="range" min="0" max="7" step="1" bind:value={o.at.cell[0]} /><output>{o.at.cell[0]}</output></label>
          <label><span>k (Z)</span>
            <input type="range" min="0" max="7" step="1" bind:value={o.at.cell[1]} /><output>{o.at.cell[1]}</output></label>
        {/if}
      {/if}
    </div>
  {/each}
{/snippet}

<main>
  <section>
    <Scene bind:this={scene} />
  </section>

  <aside>
    <fieldset>
      <legend>mode</legend>
      <div class="tabs">
        <button type="button" class:on={view === "assemble"} onclick={() => (view = "assemble")}>Assemble</button>
        <button type="button" class:on={view === "inspect"} onclick={() => (view = "inspect")}>Brick Design</button>
      </div>
    </fieldset>

    {#if view === "assemble"}
      <fieldset>
        <legend>build</legend>
        <label>
          <button type="button" onclick={replay}>▶ Assemble</button>
          <input type="range" min="0" max="1" step="0.01" bind:value={progress}
            oninput={() => (manual = true)} />
          <output>{Math.round(progress * 100)}%</output>
        </label>
        <label><span>Base Y</span>
          <input type="range" min="-8" max="8" step="0.1" bind:value={model.baseY} /><output>{(model.baseY ?? 0).toFixed(1)}</output></label>
        <div class="slots">
          {#each slots as s, i (i)}
            <button type="button" class="slot" class:on={slot === i} class:filled={s.filled}
              onclick={() => (slot = i)} title={slotLabel(s.at)}>
              {i + 1}{#if s.filled}<em>●</em>{/if}
            </button>
          {/each}
        </div>
        <div class="tabs">
          <button type="button" onclick={saveModel}>{saved ? "✓ saved" : "💾 save"}</button>
          <button type="button" onclick={loadFromStore} disabled={!slots[slot].filled}>{loaded ? "✓ loaded" : noStore ? "✕ none" : "📂 load"}</button>
          <button type="button" onclick={clearSlot} disabled={!slots[slot].filled}>🗑 clear</button>
        </div>
        <div class="tabs">
          <button type="button" onclick={() => (showCode = !showCode)}>{showCode ? "▲ hide code" : "▼ show code"}</button>
          <button type="button" onclick={resetModel}>↺ reset</button>
        </div>
        {#if showCode}
          <textarea class="code" readonly rows="6">{code}</textarea>
        {/if}
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

      <fieldset>
        <legend>connections <button type="button" class="add" onclick={addConn}>+ link</button></legend>
        <label class="iso"><input type="checkbox" bind:checked={connIso} /> isolate selected</label>
        <ul class="parts">
          {#each model.connections as c, idx (c)}
            <li>
              <button type="button" class="pick" class:on={c === selConn} class:invalid={badConns.has(idx)}
                onclick={() => (selConn = c)} title={badConns.has(idx) ? "cycle — ignored" : ""}>
                {c.a} → {c.b}{#if badConns.has(idx)}<em> ⚠ cycle</em>{/if}
              </button>
              <span class="ctl">
                <button type="button" onclick={() => moveConn(idx, -1)} disabled={idx === 0}>▲</button>
                <button type="button" onclick={() => moveConn(idx, 1)} disabled={idx === model.connections.length - 1}>▼</button>
                <button type="button" class="del" onclick={() => removeConn(idx)}>✕</button>
              </span>
            </li>
          {/each}
        </ul>
      </fieldset>

      {#if selConn && model.connections.includes(selConn)}
        {@const c = selConn}
        <fieldset>
          <legend>link — {c.a} → {c.b}</legend>
          <label><span>A (anchor)</span>
            <select bind:value={c.a}>{#each partIds as id}<option value={id}>{id}</option>{/each}</select></label>
          <label><span>B (mount)</span>
            <select bind:value={c.b}>{#each partIds as id}<option value={id}>{id}</option>{/each}</select></label>
          <label><span>On face</span>
            <select bind:value={c.on}>{#each MOUNTS as f}<option value={f}>{f}</option>{/each}</select></label>
          <label><span>Off U</span>
            <input type="range" min="-8" max="8" step="1" value={c.off?.[0] ?? 0}
              oninput={(e) => setOff(c, 0, e.currentTarget.value)} /><output>{c.off?.[0] ?? 0}</output></label>
          <label><span>Off V</span>
            <input type="range" min="-8" max="8" step="1" value={c.off?.[1] ?? 0}
              oninput={(e) => setOff(c, 1, e.currentTarget.value)} /><output>{c.off?.[1] ?? 0}</output></label>
          <label><span>Rot X°</span>
            <input type="range" min="0" max="270" step="90" value={connRot(c)[0]}
              oninput={(e) => setConnRot(c, 0, e.currentTarget.value)} /><output>{connRot(c)[0]}</output></label>
          <label><span>Rot Y°</span>
            <input type="range" min="0" max="270" step="90" value={connRot(c)[1]}
              oninput={(e) => setConnRot(c, 1, e.currentTarget.value)} /><output>{connRot(c)[1]}</output></label>
          <label><span>Rot Z°</span>
            <input type="range" min="0" max="270" step="90" value={connRot(c)[2]}
              oninput={(e) => setConnRot(c, 2, e.currentTarget.value)} /><output>{connRot(c)[2]}</output></label>
          <label><span>Joint</span>
            <select value={c.joint ?? "none"} onchange={(e) => setJoint(c, e.currentTarget.value)}>
              {#each JOINTS as j}<option value={j}>{j}</option>{/each}</select></label>
          {#if c.joint === "ball"}
            <label><span>Spin U°</span>
              <input type="range" min="-180" max="180" step="5" value={jrotOf(c)[0]}
                oninput={(e) => setJrot(c, 0, e.currentTarget.value)} /><output>{jrotOf(c)[0]}</output></label>
            <label><span>Spin V°</span>
              <input type="range" min="-180" max="180" step="5" value={jrotOf(c)[1]}
                oninput={(e) => setJrot(c, 1, e.currentTarget.value)} /><output>{jrotOf(c)[1]}</output></label>
            <label><span>Spin N°</span>
              <input type="range" min="-180" max="180" step="5" value={jrotOf(c)[2]}
                oninput={(e) => setJrot(c, 2, e.currentTarget.value)} /><output>{jrotOf(c)[2]}</output></label>
          {:else if c.joint === "hinge"}
            <label><span>Pin axis</span>
              <select bind:value={c.axis}>{#each HINGE_AXES as a}<option value={a}>{a}</option>{/each}</select></label>
            <label><span>Angle°</span>
              <input type="range" min="-180" max="180" step="5" value={c.jangle ?? 0}
                oninput={(e) => (c.jangle = +e.currentTarget.value)} /><output>{c.jangle ?? 0}</output></label>
          {/if}
        </fieldset>
      {/if}
    {:else}
      <fieldset>
        <legend>parts
          <button type="button" class="add" onclick={addPart}>+ part</button>
          <button type="button" class="add" onclick={() => addStick("I")}>+ I</button>
          <button type="button" class="add" onclick={() => addStick("Y")}>+ Y</button>
          <button type="button" class="add" onclick={() => addStick("T")}>+ T</button>
        </legend>
        <label class="iso">
          <input type="checkbox" bind:checked={iso} />
          <span>isolate selected</span>
        </label>
        <ul class="parts">
          {#each partIds as id (id)}
            <li>
              <button type="button" class="pick" class:on={id === sel} onclick={() => (sel = id)}>
                <span class="sw" style:background={hexOf(model.parts[id].color)}></span>
                {id}{#if isRoot(id)}<em> root</em>{/if}
              </button>
              <button type="button" class="del" onclick={() => removePart(id)}>✕</button>
            </li>
          {/each}
        </ul>
      </fieldset>

      {#if model.parts[sel]}
        {@const spec = model.parts[sel]}
        <fieldset>
          <legend>{sel}</legend>
          <label><span>Name</span>
            <input class="id" value={sel} onchange={(e) => renamePart(sel, e.currentTarget.value)} /></label>
          <label><span>Color</span>
            <span class="swatches">
              {#each COLORS as c}
                <button type="button" class="chip" class:on={hexOf(spec.color) === hexOf(c)}
                  style:background={PALETTE[c]} title={c}
                  aria-label={c} onclick={() => (spec.color = PALETTE[c])}></button>
              {/each}
              <input class="picker" type="color" value={hexOf(spec.color)}
                oninput={(e) => (spec.color = e.currentTarget.value)} title="custom color" />
            </span></label>
          {#if spec.stick}
            <p class="hint">{spec.stick}-stick · {endCount(spec)} ends · add connectors below</p>
          {:else}
            <label><span>Width X</span>
              <input type="range" min="1" max="8" step="1" bind:value={spec.size[0]} /><output>{spec.size[0]}</output></label>
            <label><span>Plates Y</span>
              <input type="range" min="1" max="12" step="1" bind:value={spec.size[1]} /><output>{spec.size[1]}</output></label>
            <label><span>Depth Z</span>
              <input type="range" min="1" max="8" step="1" bind:value={spec.size[2]} /><output>{spec.size[2]}</output></label>
            <label><span>Round corners</span><input type="checkbox" bind:checked={spec.round} /></label>
            {#if spec.round}
              <label><span>Radius</span>
                <input type="range" min="0.1" max="2" step="0.05" value={spec.cornerR ?? 0.5}
                  oninput={(e) => (spec.cornerR = +e.currentTarget.value)} /><output>{(spec.cornerR ?? 0.5).toFixed(2)}</output></label>
            {/if}
          {/if}
        </fieldset>

        <fieldset>
          <legend>operations</legend>
          {@render opsEditor(spec)}
        </fieldset>
      {/if}
    {/if}
  </aside>
</main>

<style>
  .tabs { display: flex; gap: 0.25rem; }
  .tabs button { flex: 1; opacity: 0.55; }
  .tabs button.on { opacity: 1; font-weight: 600; }
  .tabs button:disabled { opacity: 0.3; cursor: not-allowed; }
  .slots { display: flex; gap: 0.25rem; margin-bottom: 0.25rem; }
  .slot { flex: 1; opacity: 0.5; padding: 0.2rem 0; border-radius: 0.3rem; }
  .slot.filled { opacity: 0.8; }
  .slot.on { opacity: 1; font-weight: 600; outline: 1px solid currentColor; }
  .slot em { font-style: normal; font-size: 0.55rem; vertical-align: super; opacity: 0.7; }
  .add { font-size: 0.75rem; opacity: 0.7; margin-left: 0.5rem; }
  .hint { font-size: 0.7rem; opacity: 0.6; margin: 0.25rem 0; }
  .iso { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.4rem; }
  .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .parts li { display: flex; align-items: center; gap: 0.25rem; }
  .pick { flex: 1; display: flex; align-items: center; gap: 0.4rem; text-align: left; opacity: 0.7; padding: 0.2rem 0.4rem; border-radius: 0.3rem; }
  .pick.on { opacity: 1; font-weight: 600; }
  .pick.invalid { color: #e0524f; opacity: 0.9; }
  .pick.invalid em { color: #e0524f; opacity: 1; font-weight: 600; }
  .pick em { opacity: 0.5; font-style: normal; font-size: 0.7rem; }
  .hint { margin: 0 0 0.4rem; font-size: 0.72rem; opacity: 0.55; }
  .sw { width: 0.8rem; height: 0.8rem; border-radius: 0.2rem; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
  .swatches { display: flex; gap: 0.3rem; }
  .chip { width: 1.4rem; height: 1.4rem; border-radius: 0.3rem; border: 2px solid transparent; box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent); cursor: pointer; padding: 0; }
  .chip.on { border-color: currentColor; }
  .picker { cursor: pointer; }
  .del { opacity: 0.5; padding: 0 0.4rem; }
  .op { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 0.4rem; padding: 0.4rem 0.5rem; margin-top: 0.4rem; }
  .op header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
  .op .ctl { display: flex; gap: 0.15rem; }
  .op .ctl button { padding: 0 0.4rem; opacity: 0.7; }
  .op .ctl button:disabled { opacity: 0.25; }
  .id { flex: 1; }
  .code { width: 100%; font-family: monospace; font-size: 0.7rem; margin-top: 0.4rem; white-space: pre; overflow: auto; }
</style>
