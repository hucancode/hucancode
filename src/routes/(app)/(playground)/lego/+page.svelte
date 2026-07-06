<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as lego from "$lib/playgrounds/lego";
  import { PALETTE, MODEL, TEMPLATES, DEFAULT } from "$lib/playgrounds/lego/templates.js";
  import { connMode } from "$lib/playgrounds/lego/assembly.js";
  import { STICK_ENDS, STICK_LEN, stickSize } from "$lib/playgrounds/lego/solid.js";

  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const endCount = (spec) => (spec.stick ? STICK_ENDS : 0);

  let scene = $state(null);
  let view = $state("assemble"); // "assemble" | "inspect"
  let template = $state(DEFAULT.id);   // active template in the picker

  // viewport HUD controls
  let spin = $state(0.0);
  let explode = $state(0);
  let progress = $state(1);
  let manual = $state(false);

  const COLORS = Object.keys(PALETTE);
  // colors are stored as real hex; PALETTE keys are presets resolved to hex.
  const hexOf = (c) => (PALETTE[c] ?? c ?? "#888888").toLowerCase();
  const FACES = ["y+", "y-", "x+", "x-", "z+", "z-"];
  const MOUNTS = ["top", "bottom", "front", "back", "left", "right"];

  // ---- model = brick library + assembly TREE ------------------------------
  // model = { parts:{id:spec}, baseY, root:<node> }. A node = a clone of a brick:
  // { part, children?:[...node], + how it attaches to its parent (on/off/rot/…) }.
  const SLOT_COUNT = 5;
  const LEGACY_KEY = "lego-eagle-model";       // old single-slot store
  const slotKey = (i) => `lego-eagle-slot-${i}`;
  // op-model = every part has size[] + ops[]; reject stale/legacy stores
  function isOpModel(m) {
    return m && m.parts && Object.values(m.parts).every(
      (p) => Array.isArray(p.size) && Array.isArray(p.ops));
  }
  // accept tree models as-is; migrate old flat {root, connections} stores to a tree.
  function asTree(m) {
    if (!m) return m;
    if (m.root && typeof m.root === "object") return m;     // already a tree
    if (Array.isArray(m.connections)) return flatToTree(m);
    return m;
  }
  // flat {root:id, connections:[{a,b,...}]} -> tree. First connection naming a part
  // as `b` becomes its canonical node (gets its children); repeats become clones.
  function flatToTree(m) {
    const conns = m.connections ?? [];
    const children = new Set(conns.map((c) => c.b));
    const rootId = Object.keys(m.parts).find((id) => !children.has(id))
      ?? m.root ?? Object.keys(m.parts)[0];
    const rootNode = { part: rootId, children: [] };
    const canon = new Map([[rootId, rootNode]]);
    for (const c of conns) {
      const { a, b, ...attach } = c;
      const node = { part: b, ...attach, children: [] };
      (canon.get(a) ?? rootNode).children.push(node);
      if (!canon.has(b)) canon.set(b, node);
    }
    const clean = (n) => { if (!n.children?.length) delete n.children; else n.children.forEach(clean); return n; };
    return { parts: m.parts, baseY: m.baseY ?? 0, root: clean(rootNode) };
  }
  // slot entry = { model, at }; returns entry or null
  function readEntry(i) {
    if (!browser) return null;
    try {
      const e = JSON.parse(localStorage.getItem(slotKey(i)));
      if (e && isOpModel(e.model)) return { ...e, model: asTree(e.model) };
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
        if (isOpModel(m)) return asTree(m);
      } catch { /* corrupt store -> default */ }
    }
    return structuredClone(MODEL);
  }
  let model = $state(loadModel());
  let slot = $state(0);             // active save slot index
  let slots = $state(slotMeta());   // per-slot { filled, at }
  let sel = $state(Object.keys(loadModel().parts)[0] ?? "");  // selected brick (design tab)
  let selNode = $state(null);       // selected tree node (defaulted on mount below)
  let iso = $state(true);           // isolate: show only the selected brick (design tab)
  let nodeIso = $state(false);      // isolate: show only the selected node's sub-assembly
  let showCode = $state(false);     // code textarea hidden by default
  let saved = $state(false);
  let loaded = $state(false);
  let noStore = $state(false);    // load attempted but nothing valid saved

  const partIds = $derived(Object.keys(model.parts));
  const rootPart = $derived(model.root?.part);

  // ---- assembly tree walk + node ops --------------------------------------
  function* walkNodes(node, depth = 0, parent = null) {
    if (!node) return;
    yield { node, depth, parent };
    for (const ch of node.children ?? []) yield* walkNodes(ch, depth + 1, node);
  }
  const nodeList = $derived([...walkNodes(model.root)]);
  const nodeIndex = (n) => nodeList.findIndex((x) => x.node === n);
  // keep a valid node selected; recovers after load/reset/remove swaps the tree
  $effect(() => { if (!selNode || nodeIndex(selNode) < 0) selNode = model.root?.children?.[0] ?? model.root ?? null; });

  function findParent(root, target) {
    for (const ch of root?.children ?? []) {
      if (ch === target) return root;
      const r = findParent(ch, target);
      if (r) return r;
    }
    return null;
  }
  const isDescendant = (node, maybe) => {
    if (maybe === node) return true;
    for (const ch of node.children ?? []) if (isDescendant(ch, maybe)) return true;
    return false;
  };
  function addChild(parent) {
    if (!parent) return;
    const n = { part: partIds.includes(sel) ? sel : (partIds[0] ?? ""), on: "top", off: [0, 0], rot: [0, 0, 0] };
    parent.children = [...(parent.children ?? []), n];
    selNode = n;
  }
  function removeNode(node) {
    const p = findParent(model.root, node);
    if (!p) return;                                   // root: not removable
    p.children = p.children.filter((c) => c !== node);
    if (selNode === node) selNode = model.root;
  }
  function reparent(node, newParent) {
    if (!newParent || node === model.root || isDescendant(node, newParent)) return;
    const p = findParent(model.root, node);
    if (!p) return;
    p.children = p.children.filter((c) => c !== node);
    newParent.children = [...(newParent.children ?? []), node];
  }
  const reparentByIndex = (node, i) => reparent(node, nodeList[i]?.node);
  // legal new-parents for a node: any node not inside its own subtree
  const parentOptions = (node) => nodeList
    .filter((x) => !isDescendant(node, x.node))
    .map((x) => ({ i: nodeIndex(x.node), label: `${nodeIndex(x.node)} ${x.node.part}` }));

  // ---- part ops editing ---------------------------------------------------
  const OP_DEFAULTS = {
    slope: () => ({ op: "slope", face: "y+", dir: 1, length: 2, depth: 2, round: false }),
    push: () => ({ op: "push", face: "z+", depth: 1, width: 1, height: 1, at: [0, 0] }),
    studs: () => ({ op: "studs", face: "y+", kind: "male" }),
    ball: () => ({ op: "ball", face: "y+", kind: "male", at: { cell: [0, 0] } }),
    hinge: () => ({ op: "hinge", face: "y+", pin: "x", kind: "male", shape: "O", at: { cell: [0, 0] } }),
  };
  const opAdd = (spec, t) => {
    // on a stick, connectors target an `end` index instead of a box face
    const op = spec.stick ? { op: t, end: 0, kind: "male", ...(t === "hinge" ? { shape: "O" } : {}) } : OP_DEFAULTS[t]();
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
  // hinge: pin axis must lie in the mount face (≠ face axis); position is a cell
  const pinAxes = (face) => ["x", "y", "z"].filter((a) => a !== (face ?? "y+")[0]);
  function setHingeFace(o, f) {
    o.face = f;
    if (!pinAxes(f).includes(o.pin)) o.pin = pinAxes(f)[0];   // keep pin valid
  }
  const hingeCell = (o) => (o.at?.cell ?? [0, 0]);
  function setHingeCell(o, i, v) {
    const cell = hingeCell(o).slice();
    cell[i] = +v;
    o.at = { cell };
  }
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
  function addStick() {
    let n = 1, id = "stick1";
    while (model.parts[id]) id = `stick${++n}`;
    const len = STICK_LEN;
    model.parts[id] = {
      stick: "I",
      len,
      size: stickSize(len),
      ops: range(STICK_ENDS).map((i) => ({ op: "studs", end: i, kind: "male" })),
      color: COLORS[0],
    };
    sel = id;
  }
  // stick length: half-length in studs; keep the bounding-box size in sync
  function setStickLen(spec, v) {
    spec.len = +v;
    spec.size = stickSize(+v);
  }
  // pointy stick ends: spec.tips = list of end indices tapered to a point
  const tipSel = (s) => {
    const t = s.tips ?? [];
    if (t.length >= 2) return "both";
    if (t.includes(1)) return "1";
    if (t.includes(0)) return "0";
    return "none";
  };
  function setTips(s, v) {
    s.tips = v === "both" ? [0, 1] : v === "none" ? undefined : [Number(v)];
  }
  // remove a brick from the library AND prune every tree node that clones it
  function pruneNodes(node, id) {
    if (!node?.children) return;
    node.children = node.children.filter((c) => c.part !== id);
    node.children.forEach((c) => pruneNodes(c, id));
  }
  function removePart(id) {
    const { [id]: _, ...rest } = model.parts;
    model.parts = rest;
    if (model.root?.part === id) {
      const nid = Object.keys(rest)[0];
      model.root = nid ? { part: nid } : null;
    } else {
      pruneNodes(model.root, id);
    }
    if (sel === id) sel = Object.keys(rest)[0] ?? "";
    if (!selNode || nodeIndex(selNode) < 0) selNode = model.root;
  }
  function renameNodes(node, oldId, newId) {
    if (!node) return;
    if (node.part === oldId) node.part = newId;
    node.children?.forEach((c) => renameNodes(c, oldId, newId));
  }
  function renamePart(oldId, newId) {
    newId = newId.trim();
    if (!newId || newId === oldId || model.parts[newId]) return;
    model.parts = Object.fromEntries(
      Object.entries(model.parts).map(([k, v]) => [k === oldId ? newId : k, v]),
    );
    renameNodes(model.root, oldId, newId);
    if (sel === oldId) sel = newId;
  }

  // ---- node attachment editing --------------------------------------------
  // node rotation: [x,y,z] degrees, each a multiple of 90. legacy `angle` = Y.
  const connRot = (c) => c.rot ?? [0, c.angle ?? 0, 0];
  function setConnRot(c, i, v) {
    const r = connRot(c).slice();
    r[i] = +v;
    c.rot = r;
    delete c.angle;            // drop legacy field once edited
  }
  const setOff = (c, i, v) => {
    const o = [c.off?.[0] ?? 0, c.off?.[1] ?? 0];
    o[i] = Math.round(+v);
    c.off = o;
  };
  // where the node attaches drives the rotation logic: "face" = rigid stud clutch
  // (90deg rot + parity snap); "hinge" = articulated pivot (continuous joint).
  const ATTACH = ["face", "hinge"];
  const FREE_JOINTS = ["hinge", "ball"];
  const hingesOf = (id) => (model.parts[id]?.ops ?? [])
    .map((o, i) => ({ i, o })).filter((x) => x.o.op === "hinge");
  const hasHinge = (id) => hingesOf(id).length > 0;
  const canHinge = (node, parent) => hasHinge(parent?.part) && hasHinge(node.part);
  const hingeLabel = (o) => o.end != null
    ? `end${o.end} ${o.kind ?? "male"} ${o.shape ?? "O"}`
    : `${o.face ?? "y+"} ${o.kind ?? "male"} ${o.shape ?? "O"}`;
  const attachOf = (c) => c.attach ?? (connMode(c) === "free" ? "hinge" : "face");
  function setAttach(c, a, node, parent) {
    if (a === "hinge" && !canHinge(node, parent)) return;   // both parts need a hinge op
    c.attach = a;
    if (a === "hinge") { if (c.joint !== "ball" && c.joint !== "hinge") setJoint(c, "hinge"); }
    else setJoint(c, "none");
  }
  // joint articulation: ball = free jrot[u,v,n]deg, hinge = pitch (pin/X) + yaw (N/Y)
  function setJoint(c, kind) {
    if (kind === "ball") { c.joint = "ball"; c.jrot = c.jrot ?? [0, 0, 0]; delete c.jangle; delete c.axis; }
    else if (kind === "hinge") { c.joint = "hinge"; c.jpitch = c.jpitch ?? c.jangle ?? 0; c.jyaw = c.jyaw ?? 0; delete c.jrot; delete c.jangle; delete c.axis; }
    else { delete c.joint; delete c.jrot; delete c.jangle; delete c.axis; delete c.jpitch; delete c.jyaw; }
  }
  const jrotOf = (c) => c.jrot ?? [0, 0, 0];
  function setJrot(c, i, v) {
    const r = jrotOf(c).slice();
    r[i] = +v;
    c.jrot = r;
  }
  const setLocal = (c, on) => { if (on) c.local = true; else delete c.local; };

  function resetModel() {
    model = structuredClone(MODEL);
    sel = Object.keys(model.parts)[0] ?? "";
    selNode = model.root?.children?.[0] ?? model.root;
  }

  // load a template into the editor (fresh clone) and reframe the camera
  function pickTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    template = id;
    model = structuredClone(t.MODEL);
    sel = Object.keys(model.parts)[0] ?? "";
    selNode = model.root?.children?.[0] ?? model.root ?? null;
    if (t.VIEW) scene?.apply({ view: t.VIEW });
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
  // pretty-print a tree node, nesting `children` one level per depth
  function jsNode(node, ind) {
    const pad = "  ".repeat(ind), pad2 = "  ".repeat(ind + 1);
    const { children, ...rest } = node;
    let body = Object.entries(rest).filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}: ${js(v)}`).join(", ");
    if (children?.length) {
      const kids = children.map((c) => `${pad2}${jsNode(c, ind + 1)}`).join(",\n");
      body += `, children: [\n${kids}\n${pad}]`;
    }
    return `{ ${body} }`;
  }
  function serializeModel(m) {
    const parts = Object.entries(m.parts)
      .map(([id, s]) => `    ${id}: ${js(s)},`).join("\n");
    return `export const MODEL = {\n  parts: {\n${parts}\n  },\n  baseY: ${js(m.baseY ?? 0)},\n  root: ${jsNode(m.root, 1)},\n};`;
  }
  const code = $derived(serializeModel($state.snapshot(model)));

  // ---- scene wiring -------------------------------------------------------
  $effect(() => { scene?.apply({ spin, explode }); });
  $effect(() => { if (view === "assemble" && manual) scene?.apply({ progress }); });
  // sub-assembly rooted at the selected node (its own attachment dropped)
  function isoModel() {
    if (!selNode) return null;
    const snap = $state.snapshot(selNode);
    return { parts: $state.snapshot(model.parts), baseY: 0, root: { part: snap.part, children: snap.children ?? [] } };
  }
  $effect(() => {
    // isolate options: one brick (design tab), or the selected node's sub-assembly;
    // otherwise the full assembly, re-resolved live so edits preview in either tab.
    const sub = nodeIso ? isoModel() : null;
    if (view === "inspect" && iso && model.parts[sel])
      scene?.apply({ mode: "inspect", spec: $state.snapshot(model.parts[sel]) });
    else if (sub)
      scene?.apply({ mode: "assemble", model: sub });
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
    selNode = e.model.root?.children?.[0] ?? e.model.root ?? null;
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

{#snippet opsEditor(spec)}
  {#if !spec.stick}
    <menu>
      <li><button type="button" onclick={() => opAdd(spec, "slope")}>+ slope</button></li>
      <li><button type="button" onclick={() => opAdd(spec, "push")}>+ push</button></li>
      <li><button type="button" onclick={() => opAdd(spec, "studs")}>+ studs</button></li>
    </menu>
  {/if}
  <menu>
    {#if spec.stick}<li><button type="button" onclick={() => opAdd(spec, "studs")}>+ studs</button></li>{/if}
    <li><button type="button" onclick={() => opAdd(spec, "ball")}>+ ball</button></li>
    <li><button type="button" onclick={() => opAdd(spec, "hinge")}>+ hinge</button></li>
  </menu>
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
        <label><span>Kind</span>
          <select bind:value={o.kind}><option value="male">male</option><option value="female">female</option></select></label>
        {#if o.op === "hinge"}
          <label><span>Shape</span>
            <select bind:value={o.shape}><option value="O">O (closed)</option><option value="C">C (open)</option></select></label>
        {/if}

      {:else if o.op === "hinge"}
        <label><span>Face</span>
          <select value={o.face} onchange={(e) => setHingeFace(o, e.currentTarget.value)}>
            {#each FACES as f}<option value={f}>{f}</option>{/each}</select></label>
        <label><span>Pin axis</span>
          <select bind:value={o.pin}>{#each pinAxes(o.face) as a}<option value={a}>{a}</option>{/each}</select></label>
        <label><span>Kind</span>
          <select bind:value={o.kind}><option value="male">male</option><option value="female">female</option></select></label>
        <label><span>Shape</span>
          <select bind:value={o.shape}><option value="O">O (closed)</option><option value="C">C (open)</option></select></label>
        {#if o.kind === "female"}
          <label><span>Span</span>
            <input type="range" min="1" max="6" step="1" value={o.span ?? 1}
              oninput={(e) => (o.span = +e.currentTarget.value)} /><output>{o.span ?? 1}</output></label>
        {/if}
        <label><span>At U</span>
          <input type="range" min="0" max="11" step="1" value={hingeCell(o)[0]}
            oninput={(e) => setHingeCell(o, 0, e.currentTarget.value)} /><output>{hingeCell(o)[0]}</output></label>
        <label><span>At V</span>
          <input type="range" min="0" max="11" step="1" value={hingeCell(o)[1]}
            oninput={(e) => setHingeCell(o, 1, e.currentTarget.value)} /><output>{hingeCell(o)[1]}</output></label>

      {:else if o.op === "studs" || o.op === "ball"}
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

  <section>
    <Scene bind:this={scene} scene={lego} id="lego" />
    <footer>
      <div>
        <button type="button" onclick={replay}>▶ Assemble</button>
        <input type="range" min="0" max="1" step="0.01" bind:value={progress}
          oninput={() => (manual = true)} />
      </div>
      <div>
        <label><span>Spin</span>
          <input type="range" min="0" max="3" step="0.1" bind:value={spin} /></label>
        <label><span>Explode</span>
          <input type="range" min="0" max="2" step="0.05" bind:value={explode} /></label>
        <label><span>Base Y</span>
          <input type="range" min="-8" max="8" step="0.1" bind:value={model.baseY} /></label>
      </div>
    </footer>
  </section>

  <aside>
    <fieldset>
      <legend>mode</legend>
      <div class="square" role="group">
        <label><input type="radio" name="lego-view" value="assemble" bind:group={view} />Assemble</label>
        <label><input type="radio" name="lego-view" value="inspect" bind:group={view} />Brick Design</label>
      </div>
    </fieldset>

    {#if view === "assemble"}
      <fieldset>
        <legend>template</legend>
        <select value={template} onchange={(e) => pickTemplate(e.currentTarget.value)}>
          {#each TEMPLATES as t}<option value={t.id}>{t.name}</option>{/each}
        </select>
      </fieldset>

      <fieldset>
        <legend>storage</legend>
        <div class="slots">
          {#each slots as s, i (i)}
            <button type="button" class="slot" class:on={slot === i} class:filled={s.filled}
              onclick={() => (slot = i)} title={slotLabel(s.at)}>
              {i + 1}{#if s.filled}<em>●</em>{/if}
            </button>
          {/each}
        </div>
        <menu>
          <li><button type="button" onclick={saveModel}>{saved ? "✓ saved" : "💾 save"}</button></li>
          <li><button type="button" onclick={loadFromStore} disabled={!slots[slot].filled}>{loaded ? "✓ loaded" : noStore ? "✕ none" : "📂 load"}</button></li>
          <li><button type="button" onclick={clearSlot} disabled={!slots[slot].filled}>🗑 clear</button></li>
        </menu>
        <menu>
          <li><button type="button" onclick={() => (showCode = !showCode)}>{showCode ? "▲ hide code" : "▼ show code"}</button></li>
          <li><button type="button" onclick={resetModel}>↺ reset</button></li>
        </menu>
        {#if showCode}
          <textarea readonly rows="6">{code}</textarea>
        {/if}
      </fieldset>

      <fieldset>
        <legend>assembly <button type="button" onclick={() => addChild(selNode ?? model.root)}>+ child</button></legend>
        <label><input type="checkbox" bind:checked={nodeIso} /> isolate selected</label>
        <ul class="parts tree">
          {#each nodeList as { node, depth, parent } (node)}
            <li>
              <button type="button" class="pick" class:on={node === selNode}
                style:padding-left={`${0.3 + depth * 0.85}rem`} onclick={() => (selNode = node)}>
                <span class="sw" style:background={hexOf(model.parts[node.part]?.color)}></span>
                {node.part}{#if !parent}<em> root</em>{/if}
              </button>
              <span class="ctl">
                <button type="button" class="del" onclick={() => removeNode(node)} disabled={!parent}>✕</button>
              </span>
            </li>
          {/each}
        </ul>
      </fieldset>

      {#if selNode && nodeIndex(selNode) >= 0}
        {@const node = selNode}
        {@const parent = findParent(model.root, node)}
        <fieldset>
          <legend>node — {node.part}{parent ? ` ◂ ${parent.part}` : " (root)"}</legend>
          <label><span>Brick</span>
            <select bind:value={node.part}>{#each partIds as id}<option value={id}>{id}</option>{/each}</select></label>
          {#if parent}
            <label><span>Parent</span>
              <select value={nodeIndex(parent)} onchange={(e) => reparentByIndex(node, +e.currentTarget.value)}>
                {#each parentOptions(node) as o}<option value={o.i}>{o.label}</option>{/each}</select></label>
            <label><span>Off U</span>
              <input type="range" min="-8" max="8" step="1" value={node.off?.[0] ?? 0}
                oninput={(e) => setOff(node, 0, e.currentTarget.value)} /><output>{node.off?.[0] ?? 0}</output></label>
            <label><span>Off V</span>
              <input type="range" min="-8" max="8" step="1" value={node.off?.[1] ?? 0}
                oninput={(e) => setOff(node, 1, e.currentTarget.value)} /><output>{node.off?.[1] ?? 0}</output></label>
            <label><span>Local frame</span>
              <input type="checkbox" checked={!!node.local} onchange={(e) => setLocal(node, e.currentTarget.checked)} /></label>
            <label><span>Attach</span>
              <select value={attachOf(node)} onchange={(e) => setAttach(node, e.currentTarget.value, node, parent)}>
                {#each ATTACH as a}<option value={a} disabled={a === "hinge" && !canHinge(node, parent)}>{a}</option>{/each}</select></label>
            {#if attachOf(node) === "hinge"}
              {#if hingesOf(parent.part).length > 1}
                <label><span>A hinge</span>
                  <select value={node.ah ?? hingesOf(parent.part)[0].i} onchange={(e) => (node.ah = +e.currentTarget.value)}>
                    {#each hingesOf(parent.part) as h}<option value={h.i}>{hingeLabel(h.o)}</option>{/each}</select></label>
              {/if}
              {#if hingesOf(node.part).length > 1}
                <label><span>B hinge</span>
                  <select value={node.bh ?? hingesOf(node.part)[0].i} onchange={(e) => (node.bh = +e.currentTarget.value)}>
                    {#each hingesOf(node.part) as h}<option value={h.i}>{hingeLabel(h.o)}</option>{/each}</select></label>
              {/if}
            {/if}
            {#if attachOf(node) === "face"}
              <label><span>On face</span>
                <select bind:value={node.on}>{#each MOUNTS as f}<option value={f}>{f}</option>{/each}</select></label>
            {/if}
            {#if connMode(node) === "grid"}
              <label><span>Rot Xdeg</span>
                <input type="range" min="0" max="270" step="90" value={connRot(node)[0]}
                  oninput={(e) => setConnRot(node, 0, e.currentTarget.value)} /><output>{connRot(node)[0]}</output></label>
              <label><span>Rot Ydeg</span>
                <input type="range" min="0" max="270" step="90" value={connRot(node)[1]}
                  oninput={(e) => setConnRot(node, 1, e.currentTarget.value)} /><output>{connRot(node)[1]}</output></label>
              <label><span>Rot Zdeg</span>
                <input type="range" min="0" max="270" step="90" value={connRot(node)[2]}
                  oninput={(e) => setConnRot(node, 2, e.currentTarget.value)} /><output>{connRot(node)[2]}</output></label>
            {:else}
              <label><span>Joint</span>
                <select value={node.joint ?? "hinge"} onchange={(e) => setJoint(node, e.currentTarget.value)}>
                  {#each FREE_JOINTS as j}<option value={j}>{j}</option>{/each}</select></label>
              {#if node.joint === "ball"}
                <label><span>Spin Udeg</span>
                  <input type="range" min="-180" max="180" step="5" value={jrotOf(node)[0]}
                    oninput={(e) => setJrot(node, 0, e.currentTarget.value)} /><output>{jrotOf(node)[0]}</output></label>
                <label><span>Spin Vdeg</span>
                  <input type="range" min="-180" max="180" step="5" value={jrotOf(node)[1]}
                    oninput={(e) => setJrot(node, 1, e.currentTarget.value)} /><output>{jrotOf(node)[1]}</output></label>
                <label><span>Spin Ndeg</span>
                  <input type="range" min="-180" max="180" step="5" value={jrotOf(node)[2]}
                    oninput={(e) => setJrot(node, 2, e.currentTarget.value)} /><output>{jrotOf(node)[2]}</output></label>
              {:else if node.joint === "hinge"}
                <label><span>Pitch Xdeg</span>
                  <input type="range" min="-180" max="180" step="5" value={node.jpitch ?? 0}
                    oninput={(e) => (node.jpitch = +e.currentTarget.value)} /><output>{node.jpitch ?? 0}</output></label>
                <label><span>Yaw Ydeg</span>
                  <input type="range" min="-180" max="180" step="5" value={node.jyaw ?? 0}
                    oninput={(e) => (node.jyaw = +e.currentTarget.value)} /><output>{node.jyaw ?? 0}</output></label>
              {/if}
            {/if}
          {/if}
        </fieldset>
      {/if}
    {:else}
      <fieldset>
        <legend>parts
          <button type="button" onclick={addPart}>+ part</button>
          <button type="button" onclick={addStick}>+ stick</button>
        </legend>
        <label>
          <input type="checkbox" bind:checked={iso} />
          <span>isolate selected</span>
        </label>
        <ul class="parts">
          {#each partIds as id (id)}
            <li>
              <button type="button" class="pick" class:on={id === sel} onclick={() => (sel = id)}>
                <span class="sw" style:background={hexOf(model.parts[id].color)}></span>
                {id}{#if id === rootPart}<em> root</em>{/if}
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
            <label><span>Length</span>
              <input type="range" min="0.1" max="5" step="0.1" value={spec.len ?? 1.4}
                oninput={(e) => setStickLen(spec, e.currentTarget.value)} /><output>{(spec.len ?? 1.4).toFixed(1)}</output></label>
            <label><span>Pointy tip</span>
              <select value={tipSel(spec)} onchange={(e) => setTips(spec, e.currentTarget.value)}>
                <option value="none">none</option>
                <option value="0">end 0</option>
                <option value="1">end 1</option>
                <option value="both">both</option>
              </select></label>
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

<style>
  /* layout, HUD footer, menu rows, fieldset controls come from playground.css */
  footer label { flex: 1 1 8rem; }
  menu button { flex: 1; }
  .slots { display: flex; gap: 0.25rem; margin-bottom: 0.25rem; }
  .slot { flex: 1; opacity: 0.5; padding: 0.2rem 0; border-radius: 0.3rem; }
  .slot.filled { opacity: 0.8; }
  .slot.on { opacity: 1; font-weight: 600; outline: 1px solid currentColor; }
  .slot em { font-style: normal; font-size: 0.55rem; vertical-align: super; opacity: 0.7; }
  .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .parts li { display: flex; align-items: center; gap: 0.25rem; }
  .pick { flex: 1; display: flex; align-items: center; gap: 0.4rem; text-align: left; opacity: 0.7; padding: 0.2rem 0.4rem; border-radius: 0.3rem; }
  .pick.on { opacity: 1; font-weight: 600; }
  .pick em { opacity: 0.5; font-style: normal; font-size: 0.7rem; }
  .tree .pick { border-left: 1px solid color-mix(in srgb, currentColor 18%, transparent); }
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
  .ctl { display: flex; gap: 0.15rem; }
  .ctl button { padding: 0 0.35rem; opacity: 0.7; }
  .ctl button:disabled { opacity: 0.25; }
  .id { flex: 1; }
  textarea { font-family: monospace; font-size: 0.7rem; margin-top: 0.4rem; white-space: pre; overflow: auto; }
</style>
