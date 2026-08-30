<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as lego from "$lib/playgrounds/lego";
  import { PALETTE, TEMPLATES, DEFAULT } from "$lib/playgrounds/lego/templates.js";
  import { serializeModel } from "$lib/playgrounds/lego/serialize.js";
  import {
    slots as slotStore,
    slotLabel,
    loadModel,
  } from "$lib/playgrounds/lego/store.js";
  import {
    ATTACH, COLORS, FACES, FREE_JOINTS, MOUNTS,
    addChild, addPart, addStick, attachOf, canHinge, connMode, connRot,
    defaultModel, defaultNode, endCount, findParent, firstPartId, hexOf,
    hingeCell, hingeLabel, hingesOf, isoModel, jrotOf, nodeIndex, opAdd, opMove,
    opRemove, parentOptions, pinAxes, range, removeNode, removePart, renamePart,
    reparent, setAttach, setConnRot, setHingeCell, setHingeFace, setJoint,
    setJrot, setLocal, setOff, setStickLen, setStudRegion, setTips, studRegion,
    templateOf, tipSel, walkNodes,
  } from "$lib/playgrounds/lego/model-ops.js";

  let scene = $state(null);
  let view = $state("assemble"); // "assemble" | "inspect"
  let template = $state(DEFAULT.id); // active template in the picker

  // viewport HUD controls
  let spin = $state(0.0);
  let explode = $state(0);
  let progress = $state(1);
  let manual = $state(false);

  const initial = loadModel();
  let model = $state(initial);
  let slot = $state(0); // active save slot index
  let slots = $state(slotStore.meta()); // per-slot { filled, at }
  let sel = $state(firstPartId(initial)); // selected brick (design tab)
  let selNode = $state(null); // selected tree node (defaulted on mount below)
  let iso = $state(true); // isolate: show only the selected brick (design tab)
  let nodeIso = $state(false); // isolate: show only the selected node's sub-assembly
  let showCode = $state(false); // code textarea hidden by default
  let saved = $state(false);
  let loaded = $state(false);
  let noStore = $state(false); // load attempted but nothing valid saved

  const partIds = $derived(Object.keys(model.parts));
  const rootPart = $derived(model.root?.part);
  const nodeList = $derived([...walkNodes(model.root)]);
  const code = $derived(serializeModel($state.snapshot(model)));

  // keep a valid node selected; recovers after load/reset/remove swaps the tree
  $effect(() => {
    if (!selNode || nodeIndex(nodeList, selNode) < 0)
      selNode = defaultNode(model);
  });

  function onAddChild() {
    const n = addChild(
      selNode ?? model.root,
      partIds.includes(sel) ? sel : (partIds[0] ?? ""),
    );
    if (n) selNode = n;
  }
  function onRemoveNode(node) {
    if (removeNode(model.root, node) && selNode === node) selNode = model.root;
  }
  const reparentByIndex = (node, i) =>
    reparent(model.root, node, nodeList[i]?.node);

  function onAddPart() {
    sel = addPart(model);
  }
  function onAddStick() {
    sel = addStick(model);
  }
  function onRemovePart(id) {
    removePart(model, id);
    if (sel === id) sel = firstPartId(model);
    if (!selNode || nodeIndex(nodeList, selNode) < 0) selNode = model.root;
  }
  function onRenamePart(oldId, next) {
    const id = renamePart(model, oldId, next);
    if (id && sel === oldId) sel = id;
  }

  function resetModel() {
    model = defaultModel();
    sel = firstPartId(model);
    selNode = defaultNode(model);
  }
  // load a template into the editor (fresh clone) and reframe the camera
  function pickTemplate(id) {
    const t = templateOf(id);
    if (!t) return;
    template = id;
    model = structuredClone(t.MODEL);
    sel = firstPartId(model);
    selNode = defaultNode(model);
    if (t.VIEW) scene?.apply({ view: t.VIEW });
  }

  // ---- scene wiring -------------------------------------------------------
  $effect(() => {
    scene?.apply({ spin, explode });
  });
  $effect(() => {
    if (view === "assemble" && manual) scene?.apply({ progress });
  });
  $effect(() => {
    // isolate options: one brick (design tab), or the selected node's sub-assembly;
    // otherwise the full assembly, re-resolved live so edits preview in either tab.
    const sub =
      nodeIso && selNode
        ? isoModel($state.snapshot(model.parts), $state.snapshot(selNode))
        : null;
    if (view === "inspect" && iso && model.parts[sel])
      scene?.apply({
        mode: "inspect",
        spec: $state.snapshot(model.parts[sel]),
      });
    else if (sub) scene?.apply({ mode: "assemble", model: sub });
    else scene?.apply({ mode: "assemble", model: $state.snapshot(model) });
  });

  // explicit save / load per slot (no autosave)
  function saveModel() {
    slots = slotStore.save(slot, $state.snapshot(model));
    saved = true;
    setTimeout(() => (saved = false), 1200);
  }
  function loadFromStore() {
    const e = slotStore.read(slot);
    if (!e) {
      noStore = true;
      setTimeout(() => (noStore = false), 1200);
      return;
    }
    model = e.payload;
    sel = firstPartId(model);
    selNode = defaultNode(model);
    loaded = true;
    setTimeout(() => (loaded = false), 1200);
  }
  function clearSlot() {
    slots = slotStore.clear(slot);
  }
  function replay() {
    manual = false;
    scene?.apply({ replay: true });
  }
</script>

<svelte:head>
  <title>Lego</title>
</svelte:head>

{#snippet opsEditor(spec)}
  {#if !spec.stick}
    <menu>
      <li>
        <button type="button" onclick={() => opAdd(spec, "slope")}
          >+ slope</button
        >
      </li>
      <li>
        <button type="button" onclick={() => opAdd(spec, "push")}>+ push</button
        >
      </li>
      <li>
        <button type="button" onclick={() => opAdd(spec, "studs")}
          >+ studs</button
        >
      </li>
    </menu>
  {/if}
  <menu>
    {#if spec.stick}<li>
        <button type="button" onclick={() => opAdd(spec, "studs")}
          >+ studs</button
        >
      </li>{/if}
    <li>
      <button type="button" onclick={() => opAdd(spec, "ball")}>+ ball</button>
    </li>
    <li>
      <button type="button" onclick={() => opAdd(spec, "hinge")}>+ hinge</button
      >
    </li>
  </menu>
  {#each spec.ops as o, idx (o)}
    <article>
      <header>
        <strong>{idx + 1}. {o.op}</strong>
        <menu>
          <li>
            <button
              type="button"
              onclick={() => opMove(spec, idx, -1)}
              disabled={idx === 0}>▲</button
            >
          </li>
          <li>
            <button
              type="button"
              onclick={() => opMove(spec, idx, 1)}
              disabled={idx === spec.ops.length - 1}>▼</button
            >
          </li>
          <li>
            <button type="button" onclick={() => opRemove(spec, idx)}>✕</button>
          </li>
        </menu>
      </header>

      {#if o.op === "slope"}
        <label
          ><span>Face</span>
          <select bind:value={o.face}
            >{#each FACES as f}<option value={f}>{f}</option>{/each}</select
          ></label
        >
        <label
          ><span>Dir</span>
          <select bind:value={o.dir}
            ><option value={1}>forward</option><option value={-1}
              >backward</option
            ></select
          ></label
        >
        <label
          ><span>Length</span>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            bind:value={o.length}
          /><output>{o.length}</output></label
        >
        <label
          ><span>Depth</span>
          <input
            type="range"
            min="1"
            max="9"
            step="1"
            bind:value={o.depth}
          /><output>{o.depth}</output></label
        >
        <label
          ><span>Curve</span><input
            type="checkbox"
            bind:checked={o.round}
          /></label
        >
      {:else if o.op === "push"}
        <label
          ><span>Face</span>
          <select bind:value={o.face}
            >{#each FACES as f}<option value={f}>{f}</option>{/each}</select
          ></label
        >
        <label
          ><span>Depth</span>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            bind:value={o.depth}
          /><output>{o.depth}</output></label
        >
        <label
          ><span>Width</span>
          <input
            type="range"
            min="1"
            max="8"
            step="1"
            bind:value={o.width}
          /><output>{o.width}</output></label
        >
        <label
          ><span>Height</span>
          <input
            type="range"
            min="1"
            max="9"
            step="1"
            bind:value={o.height}
          /><output>{o.height}</output></label
        >
        <label
          ><span>At U</span>
          <input
            type="range"
            min="0"
            max="7"
            step="1"
            bind:value={o.at[0]}
          /><output>{o.at[0]}</output></label
        >
        <label
          ><span>At V</span>
          <input
            type="range"
            min="0"
            max="8"
            step="1"
            bind:value={o.at[1]}
          /><output>{o.at[1]}</output></label
        >
      {:else if (o.op === "studs" || o.op === "ball" || o.op === "hinge") && spec.stick}
        <label
          ><span>End</span>
          <select bind:value={o.end}
            >{#each range(endCount(spec)) as i}<option value={i}>{i}</option
              >{/each}</select
          ></label
        >
        <label
          ><span>Kind</span>
          <select bind:value={o.kind}
            ><option value="male">male</option><option value="female"
              >female</option
            ></select
          ></label
        >
        {#if o.op === "hinge"}
          <label
            ><span>Shape</span>
            <select bind:value={o.shape}
              ><option value="O">O (closed)</option><option value="C"
                >C (open)</option
              ></select
            ></label
          >
        {/if}
      {:else if o.op === "hinge"}
        <label
          ><span>Face</span>
          <select
            value={o.face}
            onchange={(e) => setHingeFace(o, e.currentTarget.value)}
          >
            {#each FACES as f}<option value={f}>{f}</option>{/each}</select
          ></label
        >
        <label
          ><span>Pin axis</span>
          <select bind:value={o.pin}
            >{#each pinAxes(o.face) as a}<option value={a}>{a}</option
              >{/each}</select
          ></label
        >
        <label
          ><span>Kind</span>
          <select bind:value={o.kind}
            ><option value="male">male</option><option value="female"
              >female</option
            ></select
          ></label
        >
        <label
          ><span>Shape</span>
          <select bind:value={o.shape}
            ><option value="O">O (closed)</option><option value="C"
              >C (open)</option
            ></select
          ></label
        >
        {#if o.kind === "female"}
          <label
            ><span>Span</span>
            <input
              type="range"
              min="1"
              max="6"
              step="1"
              value={o.span ?? 1}
              oninput={(e) => (o.span = +e.currentTarget.value)}
            /><output>{o.span ?? 1}</output></label
          >
        {/if}
        <label
          ><span>At U</span>
          <input
            type="range"
            min="0"
            max="11"
            step="1"
            value={hingeCell(o)[0]}
            oninput={(e) => setHingeCell(o, 0, e.currentTarget.value)}
          /><output>{hingeCell(o)[0]}</output></label
        >
        <label
          ><span>At V</span>
          <input
            type="range"
            min="0"
            max="11"
            step="1"
            value={hingeCell(o)[1]}
            oninput={(e) => setHingeCell(o, 1, e.currentTarget.value)}
          /><output>{hingeCell(o)[1]}</output></label
        >
      {:else if o.op === "studs" || o.op === "ball"}
        <label
          ><span>Face</span>
          <select bind:value={o.face}
            >{#each FACES as f}<option value={f}>{f}</option>{/each}</select
          ></label
        >
        <label
          ><span>Kind</span>
          <select bind:value={o.kind}
            ><option value="male">male</option><option value="female"
              >female</option
            ></select
          ></label
        >
        <label
          ><span>Region</span>
          <select
            value={studRegion(o)}
            onchange={(e) => setStudRegion(o, e.currentTarget.value)}
          >
            <option value="all">all</option><option value="row">row</option>
            <option value="col">col</option><option value="cell">cell</option>
          </select></label
        >
        {#if studRegion(o) === "row"}
          <label
            ><span>k (Z)</span>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              bind:value={o.at.row}
            /><output>{o.at.row}</output></label
          >
        {:else if studRegion(o) === "col"}
          <label
            ><span>i (X)</span>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              bind:value={o.at.col}
            /><output>{o.at.col}</output></label
          >
        {:else if studRegion(o) === "cell"}
          <label
            ><span>i (X)</span>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              bind:value={o.at.cell[0]}
            /><output>{o.at.cell[0]}</output></label
          >
          <label
            ><span>k (Z)</span>
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              bind:value={o.at.cell[1]}
            /><output>{o.at.cell[1]}</output></label
          >
        {/if}
      {/if}
    </article>
  {/each}
{/snippet}

<section>
  <Scene bind:this={scene} scene={lego} id="lego" />
  <footer>
    <menu>
      <li><button type="button" onclick={replay}>▶ Assemble</button></li>
      <li>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          bind:value={progress}
          oninput={() => (manual = true)}
        />
      </li>
    </menu>
    <menu>
      <li>
        <label
          ><span>Spin</span>
          <input
            type="range"
            min="0"
            max="3"
            step="0.1"
            bind:value={spin}
          /></label
        >
      </li>
      <li>
        <label
          ><span>Explode</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            bind:value={explode}
          /></label
        >
      </li>
      <li>
        <label
          ><span>Base Y</span>
          <input
            type="range"
            min="-8"
            max="8"
            step="0.1"
            bind:value={model.baseY}
          /></label
        >
      </li>
    </menu>
  </footer>
</section>

<aside>
  <fieldset>
    <legend>mode</legend>
    <menu role="group">
      <li><label
        ><input
          type="radio"
          name="lego-view"
          value="assemble"
          bind:group={view}
        />Assemble</label
      ></li>
      <li><label
        ><input
          type="radio"
          name="lego-view"
          value="inspect"
          bind:group={view}
        />Brick Design</label
      ></li>
    </menu>
  </fieldset>

  {#if view === "assemble"}
    <fieldset>
      <legend>template</legend>
      <select
        value={template}
        onchange={(e) => pickTemplate(e.currentTarget.value)}
      >
        {#each TEMPLATES as t}<option value={t.id}>{t.name}</option>{/each}
      </select>
    </fieldset>

    <fieldset>
      <legend>storage</legend>
      <menu role="group" aria-label="storage slots">
        {#each slots as s, i (i)}
          <li><label title={slotLabel(s.at)}>
            <input type="radio" name="lego-slot" value={i} bind:group={slot} />
            {i + 1}{#if s.filled}<em>●</em>{/if}
          </label></li>
        {/each}
      </menu>
      <menu>
        <li>
          <button type="button" onclick={saveModel}
            >{saved ? "✓ saved" : "💾 save"}</button
          >
        </li>
        <li>
          <button
            type="button"
            onclick={loadFromStore}
            disabled={!slots[slot].filled}
            >{loaded ? "✓ loaded" : noStore ? "✕ none" : "📂 load"}</button
          >
        </li>
        <li>
          <button
            type="button"
            onclick={clearSlot}
            disabled={!slots[slot].filled}>🗑 clear</button
          >
        </li>
      </menu>
      <menu>
        <li>
          <button type="button" onclick={() => (showCode = !showCode)}
            >{showCode ? "▲ hide code" : "▼ show code"}</button
          >
        </li>
        <li><button type="button" onclick={resetModel}>reset</button></li>
      </menu>
      {#if showCode}
        <textarea readonly rows="6">{code}</textarea>
      {/if}
    </fieldset>

    <fieldset>
      <legend
        >assembly <button type="button" onclick={onAddChild}>+ child</button
        ></legend
      >
      <label
        ><input type="checkbox" bind:checked={nodeIso} /> isolate selected</label
      >
      <ol>
        {#each nodeList as { node, depth, parent } (node)}
          <li>
            <label style="--depth: {depth}">
              <input
                type="radio"
                name="lego-node"
                value={node}
                bind:group={selNode}
              />
              <span style="--swatch: {hexOf(model.parts[node.part]?.color)}"
              ></span>
              {node.part}{#if !parent}<em> root</em>{/if}
            </label>
            <button
              type="button"
              onclick={() => onRemoveNode(node)}
              disabled={!parent}>✕</button
            >
          </li>
        {/each}
      </ol>
    </fieldset>

    {#if selNode && nodeIndex(nodeList, selNode) >= 0}
      {@const node = selNode}
      {@const parent = findParent(model.root, node)}
      <fieldset>
        <legend
          >node — {node.part}{parent ? ` ◂ ${parent.part}` : " (root)"}</legend
        >
        <label
          ><span>Brick</span>
          <select bind:value={node.part}
            >{#each partIds as id}<option value={id}>{id}</option
              >{/each}</select
          ></label
        >
        {#if parent}
          <label
            ><span>Parent</span>
            <select
              value={nodeIndex(nodeList, parent)}
              onchange={(e) => reparentByIndex(node, +e.currentTarget.value)}
            >
              {#each parentOptions(nodeList, node) as o}<option value={o.i}
                  >{o.label}</option
                >{/each}</select
            ></label
          >
          <label
            ><span>Off U</span>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={node.off?.[0] ?? 0}
              oninput={(e) => setOff(node, 0, e.currentTarget.value)}
            /><output>{node.off?.[0] ?? 0}</output></label
          >
          <label
            ><span>Off V</span>
            <input
              type="range"
              min="-8"
              max="8"
              step="1"
              value={node.off?.[1] ?? 0}
              oninput={(e) => setOff(node, 1, e.currentTarget.value)}
            /><output>{node.off?.[1] ?? 0}</output></label
          >
          <label
            ><span>Local frame</span>
            <input
              type="checkbox"
              checked={!!node.local}
              onchange={(e) => setLocal(node, e.currentTarget.checked)}
            /></label
          >
          <label
            ><span>Attach</span>
            <select
              value={attachOf(node)}
              onchange={(e) =>
                setAttach(model, node, e.currentTarget.value, node, parent)}
            >
              {#each ATTACH as a}<option
                  value={a}
                  disabled={a === "hinge" && !canHinge(model, node, parent)}
                  >{a}</option
                >{/each}</select
            ></label
          >
          {#if attachOf(node) === "hinge"}
            {#if hingesOf(model, parent.part).length > 1}
              <label
                ><span>A hinge</span>
                <select
                  value={node.ah ?? hingesOf(model, parent.part)[0].i}
                  onchange={(e) => (node.ah = +e.currentTarget.value)}
                >
                  {#each hingesOf(model, parent.part) as h}<option value={h.i}
                      >{hingeLabel(h.o)}</option
                    >{/each}</select
                ></label
              >
            {/if}
            {#if hingesOf(model, node.part).length > 1}
              <label
                ><span>B hinge</span>
                <select
                  value={node.bh ?? hingesOf(model, node.part)[0].i}
                  onchange={(e) => (node.bh = +e.currentTarget.value)}
                >
                  {#each hingesOf(model, node.part) as h}<option value={h.i}
                      >{hingeLabel(h.o)}</option
                    >{/each}</select
                ></label
              >
            {/if}
          {/if}
          {#if attachOf(node) === "face"}
            <label
              ><span>On face</span>
              <select bind:value={node.on}
                >{#each MOUNTS as f}<option value={f}>{f}</option
                  >{/each}</select
              ></label
            >
          {/if}
          {#if connMode(node) === "grid"}
            <label
              ><span>Rot X</span>
              <input
                type="range"
                min="0"
                max="270"
                step="90"
                value={connRot(node)[0]}
                oninput={(e) => setConnRot(node, 0, e.currentTarget.value)}
              /><output>{connRot(node)[0]}</output></label
            >
            <label
              ><span>Rot Y</span>
              <input
                type="range"
                min="0"
                max="270"
                step="90"
                value={connRot(node)[1]}
                oninput={(e) => setConnRot(node, 1, e.currentTarget.value)}
              /><output>{connRot(node)[1]}</output></label
            >
            <label
              ><span>Rot Z</span>
              <input
                type="range"
                min="0"
                max="270"
                step="90"
                value={connRot(node)[2]}
                oninput={(e) => setConnRot(node, 2, e.currentTarget.value)}
              /><output>{connRot(node)[2]}</output></label
            >
          {:else}
            <label
              ><span>Joint</span>
              <select
                value={node.joint ?? "hinge"}
                onchange={(e) => setJoint(node, e.currentTarget.value)}
              >
                {#each FREE_JOINTS as j}<option value={j}>{j}</option
                  >{/each}</select
              ></label
            >
            {#if node.joint === "ball"}
              <label
                ><span>Spin U</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={jrotOf(node)[0]}
                  oninput={(e) => setJrot(node, 0, e.currentTarget.value)}
                /><output>{jrotOf(node)[0]}</output></label
              >
              <label
                ><span>Spin V</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={jrotOf(node)[1]}
                  oninput={(e) => setJrot(node, 1, e.currentTarget.value)}
                /><output>{jrotOf(node)[1]}</output></label
              >
              <label
                ><span>Spin N</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={jrotOf(node)[2]}
                  oninput={(e) => setJrot(node, 2, e.currentTarget.value)}
                /><output>{jrotOf(node)[2]}</output></label
              >
            {:else if node.joint === "hinge"}
              <label
                ><span>Pitch X</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={node.jpitch ?? 0}
                  oninput={(e) => (node.jpitch = +e.currentTarget.value)}
                /><output>{node.jpitch ?? 0}</output></label
              >
              <label
                ><span>Yaw Y</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  value={node.jyaw ?? 0}
                  oninput={(e) => (node.jyaw = +e.currentTarget.value)}
                /><output>{node.jyaw ?? 0}</output></label
              >
            {/if}
          {/if}
        {/if}
      </fieldset>
    {/if}
  {:else}
    <fieldset>
      <legend
        >parts
        <button type="button" onclick={onAddPart}>+ part</button>
        <button type="button" onclick={onAddStick}>+ stick</button>
      </legend>
      <label>
        <input type="checkbox" bind:checked={iso} />
        <span>isolate selected</span>
      </label>
      <ul>
        {#each partIds as id (id)}
          <li>
            <label>
              <input
                type="radio"
                name="lego-part"
                value={id}
                bind:group={sel}
              />
              <span style="--swatch: {hexOf(model.parts[id].color)}"></span>
              {id}{#if id === rootPart}<em> root</em>{/if}
            </label>
            <button type="button" onclick={() => onRemovePart(id)}>✕</button>
          </li>
        {/each}
      </ul>
    </fieldset>

    {#if model.parts[sel]}
      {@const spec = model.parts[sel]}
      <fieldset>
        <legend>{sel}</legend>
        <label
          ><span>Name</span>
          <input
            type="text"
            value={sel}
            onchange={(e) => onRenamePart(sel, e.currentTarget.value)}
          /></label
        >
        <label
          ><span>Color</span>
          <span>
            {#each COLORS as c}
              <button
                type="button"
                aria-pressed={hexOf(spec.color) === hexOf(c)}
                style="--swatch: {PALETTE[c]}"
                title={c}
                aria-label={c}
                onclick={() => (spec.color = PALETTE[c])}
              ></button>
            {/each}
            <input
              type="color"
              value={hexOf(spec.color)}
              oninput={(e) => (spec.color = e.currentTarget.value)}
              title="custom color"
            />
          </span></label
        >
        {#if spec.stick}
          <label
            ><span>Length</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={spec.len ?? 1.4}
              oninput={(e) => setStickLen(spec, e.currentTarget.value)}
            /><output>{(spec.len ?? 1.4).toFixed(1)}</output></label
          >
          <label
            ><span>Pointy tip</span>
            <select
              value={tipSel(spec)}
              onchange={(e) => setTips(spec, e.currentTarget.value)}
            >
              <option value="none">none</option>
              <option value="0">end 0</option>
              <option value="1">end 1</option>
              <option value="both">both</option>
            </select></label
          >
        {:else}
          <label
            ><span>Width X</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              bind:value={spec.size[0]}
            /><output>{spec.size[0]}</output></label
          >
          <label
            ><span>Plates Y</span>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              bind:value={spec.size[1]}
            /><output>{spec.size[1]}</output></label
          >
          <label
            ><span>Depth Z</span>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              bind:value={spec.size[2]}
            /><output>{spec.size[2]}</output></label
          >
          <label
            ><span>Round corners</span><input
              type="checkbox"
              bind:checked={spec.round}
            /></label
          >
          {#if spec.round}
            <label
              ><span>Radius</span>
              <input
                type="range"
                min="0.1"
                max="2"
                step="0.05"
                value={spec.cornerR ?? 0.5}
                oninput={(e) => (spec.cornerR = +e.currentTarget.value)}
              /><output>{(spec.cornerR ?? 0.5).toFixed(2)}</output></label
            >
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

<style>
  aside menu button {
    flex: 1;
  }
  /* assembly tree: indent one level per depth */
  ol li > label {
    padding-left: calc(0.3rem + var(--depth, 0) * 0.85rem);
  }
  li > label > span:empty {
    background: var(--swatch);
  }
  /* color swatch row inside the Color label */
  label > span + span {
    display: flex;
    gap: 0.3rem;
  }
  span + span button {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 0.3rem;
    border: 2px solid transparent;
    background: var(--swatch);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, currentColor 30%, transparent);
    cursor: pointer;
    padding: 0;
  }
  span + span button[aria-pressed="true"] {
    border-color: currentColor;
  }
  input[type="color"] {
    cursor: pointer;
  }
  /* one operation card */
  article {
    border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
    border-radius: 0.4rem;
    padding: 0.4rem 0.5rem;
    margin-top: 0.4rem;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.3rem;
  }
  header menu {
    gap: 0.15rem;
  }
  header menu button {
    flex: none;
    padding: 0 0.4rem;
    opacity: 0.7;
  }
  header menu button:disabled {
    opacity: 0.25;
  }
  textarea {
    font-family: monospace;
    font-size: 0.7rem;
    margin-top: 0.4rem;
    white-space: pre;
    overflow: auto;
  }
</style>
