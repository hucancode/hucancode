<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/mech.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import { buildHumanoidRig } from "$lib/playgrounds/mech/rig/index.js";
  import { rigToPrimitives, jointCatalog, JOINT_PARAMS, JOINT_NAMES, PALETTE } from "$lib/playgrounds/mech/design/index.js";
  import { texRowOf } from "$lib/playgrounds/mech/sdf.js";

  let scene = $state(null);

  // what the viewport shows: the assembled mech, or the joint reference catalog
  let view = $state("mech");           // "mech" | "joints"

  // engine params (what the artist controls) -------------------------------
  let fingers = $state(true);          // rig engine: include hands/fingers
  let accent = $state(PALETTE.accent); // design engine: focal hue
  const ACCENTS = ["#d6552f", "#e8b730", "#3fb6d0", "#6fcf57", "#c64bd0", "#e0e0e0"];

  // HUD state
  let stage = $state(3);        // pipeline reveal: 1 base, 2 +bool, 3 +detail
  let spin = $state(0.3);
  let shadow = $state(false);
  let ground = $state(false);
  let light = $state(0.6);

  const STORE = "mech-rig";
  const clone = (m) => structuredClone(m);
  // RIG is the editable source of truth. design engine derives primitives from it
  // live; render engine draws those. (rig -> design -> render, one way.)
  let rig = $state(loadRig());
  let sel = $state(0);           // selected bone index
  let saved = $state(false), loaded = $state(false), noStore = $state(false);
  let showCode = $state(false);

  function build() { return buildHumanoidRig({ fingers }); }
  function loadRig() {
    if (browser) {
      try {
        const r = JSON.parse(localStorage.getItem(STORE));
        if (r && Array.isArray(r.bones)) return r;
      } catch { /* fall through to a freshly built rig */ }
    }
    return build();
  }
  // rebuild the rig from the fingers param (discards manual edits)
  function regen() {
    rig = build();
    sel = 0;
    scene?.apply({ resetView: true });
  }

  // editable joint-catalog params (cloned from the design-engine defaults) + the
  // sliders that drive them. each entry: [key, label, min, max].
  let jparams = $state(structuredClone(JOINT_PARAMS));
  let selJoint = $state(JOINT_NAMES[0]);   // which joint the catalog renders + configs
  const JOINT_LABELS = { hinge: "hinge", hingePivot: "hinge-pivot", pivot: "pivot", ball: "ball" };
  const JOINT_CTL = {
    hinge: [["width", "width", 0.2, 0.7], ["depth", "depth", 0.2, 0.9], ["femaleWidth", "female arm", 0.1, 2.0], ["maleWidth", "male arm", 0.1, 2.0], ["gapWidth", "gap", 0, 1.0], ["height", "height", 0.8, 3.0], ["tongueLength", "tongue length", 0, 1], ["socketLength", "socket length", 0, 1], ["socketThickness", "socket thickness", 0, 1], ["bevel", "bevel", 0, 2.5]],
    hingePivot: [["width", "width", 0.2, 0.7], ["depth", "depth", 0.2, 0.9], ["femaleWidth", "female arm", 0.1, 2.0], ["maleWidth", "male arm", 0.1, 2.0], ["gapWidth", "gap", 0, 1.0], ["height", "height", 0.8, 3.0], ["tongueLength", "tongue length", 0, 1], ["socketLength", "socket length", 0, 1], ["socketThickness", "socket thickness", 0, 1], ["discRadius", "disc radius", 0.2, 1.2], ["discThickness", "disc thickness", 0.03, 0.3], ["bevel", "bevel", 0, 2.5]],
    pivot: [["radius", "radius", 0.3, 1.2], ["thickness", "ring thickness", 0.04, 0.4], ["gap", "ring gap", 0.2, 2.0], ["height", "height", 0.5, 2.0], ["bevel", "bevel", 0, 2.5]],
    ball: [["ballRadius", "ball radius", 0.3, 0.9], ["band", "yoke band", 0.08, 0.4], ["wrap", "yoke wrap", 1.2, 2.8], ["bevel", "bevel", 0, 2.5]],
  };
  function resetJoints() { jparams = structuredClone(JOINT_PARAMS); }

  // design engine output — the assembled mech, or the joint catalog reference.
  // recomputes whenever the rig, accent, view, or joint params change.
  const model = $derived(
    view === "joints"
      ? jointCatalog({ accent, which: selJoint, params: $state.snapshot(jparams) })
      : rigToPrimitives($state.snapshot(rig), { accent }),
  );

  const KINDS = ["pelvis", "torso", "head", "shoulder", "hip", "limb", "hand", "foot", "digit"];
  const JOINTS = [["0 weld", 0], ["1 yaw", 1], ["2 pitch", 2], ["3 uni · 2-axis", 3], ["4 ball", 4]];
  const AX = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
  const axisLabel = (v) => (!v ? "X" : v[0] ? "X" : v[1] ? "Y" : "Z");

  const bone = $derived(rig.bones[sel] ?? null);
  const stageLabel = $derived(["", "1 · limbs + joints", "2 · joint mechanics", "3 · hands + detail"][stage]);
  // map the selected bone to its first packed primitive row, for the render highlight
  const selectedRow = $derived.by(() => {
    const idx = model.nodes.findIndex((n) => n._bone === sel);
    return idx < 0 ? -1 : texRowOf(model, idx);
  });

  // ---- push reactive state into the scene ---------------------------------
  $effect(() => { scene?.apply({ stage }); });
  $effect(() => { scene?.apply({ spin }); });
  $effect(() => { scene?.apply({ shadow: shadow ? 1 : 0 }); });
  $effect(() => { scene?.apply({ ground: ground ? 1 : 0 }); });
  $effect(() => { scene?.apply({ lightAngle: light }); });
  // re-derive + re-pack on any rig or accent edit
  $effect(() => { scene?.apply({ model }); });
  $effect(() => { scene?.apply({ selected: selectedRow }); });
  // refit the camera when switching mech <-> catalog (each model ships its own
  // framing distance). runs after the model effect, so dist is already current.
  $effect(() => { view; selJoint; scene?.apply({ resetView: true }); });

  // ---- bone CRUD ----------------------------------------------------------
  function addBone() {
    const a = bone ? bone.b.slice() : [0, 0, 0];
    const b = [a[0], a[1] - 0.6, a[2]];
    rig.bones = [...rig.bones, {
      id: `bone${rig.bones.length}`, parent: bone?.id ?? null, kind: "limb",
      a, b, radius: 0.2, joint: 2, axis1: [1, 0, 0], sym: bone?.sym ?? false,
    }];
    sel = rig.bones.length - 1;
  }
  function removeBone(i) {
    rig.bones = rig.bones.filter((_, j) => j !== i);
    sel = Math.max(0, Math.min(sel, rig.bones.length - 1));
  }
  function dupBone(i) {
    const n = clone($state.snapshot(rig.bones[i]));
    n.id = `${n.id}_copy`;
    n.a = [n.a[0] + 0.3, n.a[1], n.a[2]];
    n.b = [n.b[0] + 0.3, n.b[1], n.b[2]];
    rig.bones = [...rig.bones.slice(0, i + 1), n, ...rig.bones.slice(i + 1)];
    sel = i + 1;
  }
  const setPt = (key, i, v) => {
    const a = (bone[key] ?? [0, 0, 0]).slice();
    a[i] = +v; bone[key] = a;
  };
  const setAxis = (key, label) => { bone[key] = AX[label].slice(); };

  function resetRig() { regen(); }

  function save() {
    if (!browser) return;
    localStorage.setItem(STORE, JSON.stringify($state.snapshot(rig)));
    saved = true; setTimeout(() => (saved = false), 1200);
  }
  function load() {
    if (!browser) return;
    try {
      const r = JSON.parse(localStorage.getItem(STORE));
      if (r && Array.isArray(r.bones)) { rig = r; sel = 0; loaded = true; setTimeout(() => (loaded = false), 1200); return; }
    } catch { /* nothing valid */ }
    noStore = true; setTimeout(() => (noStore = false), 1200);
  }

  const code = $derived(JSON.stringify($state.snapshot(rig), null, 1));
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
      <legend>view</legend>
      <div class="tabs">
        <button type="button" class:on={view === "mech"} onclick={() => (view = "mech")}>🤖 mech</button>
        <button type="button" class:on={view === "joints"} onclick={() => (view = "joints")}>⚙ joints</button>
      </div>
    </fieldset>

    {#if view === "joints"}
    <fieldset>
      <legend>joint</legend>
      <ul class="jlist">
        {#each JOINT_NAMES as jn}
          <li><button type="button" class:on={selJoint === jn} onclick={() => (selJoint = jn)}>{JOINT_LABELS[jn] ?? jn}</button></li>
        {/each}
      </ul>
    </fieldset>
    <fieldset>
      <legend>{JOINT_LABELS[selJoint] ?? selJoint} params <button type="button" class="add" onclick={resetJoints}>↺ reset</button></legend>
      {#each JOINT_CTL[selJoint] as [key, label, min, max]}
        <label><span>{label}</span>
          <input type="range" {min} {max} step="0.01" value={jparams[selJoint][key]}
            oninput={(e) => (jparams[selJoint][key] = +e.currentTarget.value)} />
          <output>{jparams[selJoint][key].toFixed(2)}</output></label>
      {/each}
    </fieldset>
    {:else}
    <fieldset>
      <legend>rig + design</legend>
      <label class="chk"><input type="checkbox" bind:checked={fingers} onchange={regen} /> <span>Hands &amp; fingers</span></label>
      <div class="grp">accent</div>
      <span class="swatches">
        {#each ACCENTS as c}
          <button type="button" class="chip" class:on={accent.toLowerCase() === c}
            style:background={c} aria-label={c} onclick={() => (accent = c)}></button>
        {/each}
      </span>
      <button type="button" class="go wide" onclick={regen}>⚙ regenerate</button>
    </fieldset>

    <fieldset>
      <legend>storage</legend>
      <div class="tabs">
        <button type="button" onclick={save}>{saved ? "✓ saved" : "💾 save"}</button>
        <button type="button" onclick={load}>{loaded ? "✓ loaded" : noStore ? "✕ none" : "📂 load"}</button>
        <button type="button" onclick={resetRig}>↺ reset</button>
      </div>
      <button type="button" class="wide" onclick={() => (showCode = !showCode)}>{showCode ? "▲ hide code" : "▼ show code"}</button>
      {#if showCode}<textarea class="code" readonly rows="7">{code}</textarea>{/if}
    </fieldset>

    <fieldset>
      <legend>rig · bones <button type="button" class="add" onclick={addBone}>+ bone</button></legend>
      <ul class="parts">
        {#each rig.bones as b, i (i)}
          <li>
            <button type="button" class="pick" class:on={i === sel} onclick={() => (sel = i)}>
              <span class="jt jt{b.joint}" title={JOINTS[b.joint]?.[0]}>{b.joint}</span>
              <span class="nm">{b.id}</span>
              <em>{b.kind}{b.sym ? " ⇄" : ""}</em>
            </button>
            <span class="ctl">
              <button type="button" onclick={() => dupBone(i)} title="duplicate">⧉</button>
              <button type="button" class="del" onclick={() => removeBone(i)}>✕</button>
            </span>
          </li>
        {/each}
      </ul>
    </fieldset>

    {#if bone}
      <fieldset>
        <legend>bone — {bone.id}</legend>
        <label><span>ID</span>
          <input class="id" value={bone.id} onchange={(e) => (bone.id = e.currentTarget.value)} /></label>
        <label><span>Part kind</span>
          <select bind:value={bone.kind}>{#each KINDS as k}<option value={k}>{k}</option>{/each}</select></label>
        <label><span>Joint</span>
          <select value={bone.joint} onchange={(e) => (bone.joint = +e.currentTarget.value)}>
            {#each JOINTS as [lab, v]}<option value={v}>{lab}</option>{/each}</select></label>
        <label class="chk"><input type="checkbox" bind:checked={bone.sym} /> <span>Mirror L/R (X)</span></label>
        <label><span>Radius</span>
          <input type="range" min="0.02" max="0.8" step="0.01" value={bone.radius}
            oninput={(e) => (bone.radius = +e.currentTarget.value)} /><output>{bone.radius.toFixed(2)}</output></label>

        {#if bone.joint === 2 || bone.joint === 3}
          <div class="grp">joint axis</div>
          <label><span>Pitch axis</span>
            <select value={axisLabel(bone.axis1)} onchange={(e) => setAxis("axis1", e.currentTarget.value)}>
              <option>X</option><option>Y</option><option>Z</option></select></label>
        {/if}

        <div class="grp">A · proximal (joint)</div>
        {#each ["X", "Y", "Z"] as ax, i}
          <label><span>A {ax}</span>
            <input type="range" min="-3" max="3.5" step="0.02" value={bone.a?.[i] ?? 0}
              oninput={(e) => setPt("a", i, e.currentTarget.value)} /><output>{(bone.a?.[i] ?? 0).toFixed(2)}</output></label>
        {/each}
        <div class="grp">B · distal (end)</div>
        {#each ["X", "Y", "Z"] as ax, i}
          <label><span>B {ax}</span>
            <input type="range" min="-3" max="3.5" step="0.02" value={bone.b?.[i] ?? 0}
              oninput={(e) => setPt("b", i, e.currentTarget.value)} /><output>{(bone.b?.[i] ?? 0).toFixed(2)}</output></label>
        {/each}
      </fieldset>
    {/if}
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
  .tabs button.on { outline: 1px solid color-mix(in srgb, currentColor 40%, transparent); font-weight: 600; }
  .jlist { list-style: none; margin: 0.4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .jlist button { width: 100%; text-align: left; }
  .jlist button.on { outline: 1px solid color-mix(in srgb, currentColor 40%, transparent); font-weight: 600; }
  .cat { list-style: none; margin: 0.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .cat li { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.74rem; line-height: 1.35; opacity: 0.85; }
  .cat li .jt { align-self: flex-start; margin-top: 0.1rem; }
  .cat b { font-weight: 600; }
  .hint { font-size: 0.68rem; opacity: 0.5; margin: 0.6rem 0 0; }
  .go { font-weight: 600; }
  .wide { width: 100%; margin-top: 0.4rem; }
  .add { font-size: 0.75rem; opacity: 0.75; margin-left: 0.4rem; }
  .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.12rem; max-height: 16rem; overflow-y: auto; }
  .parts li { display: flex; align-items: center; gap: 0.2rem; }
  .pick { flex: 1; display: flex; align-items: center; gap: 0.4rem; text-align: left; opacity: 0.7; padding: 0.18rem 0.35rem; border-radius: 0.3rem; }
  .pick.on { opacity: 1; font-weight: 600; outline: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
  .jt { flex: none; width: 1.1rem; height: 1.1rem; border-radius: 0.25rem; display: grid; place-items: center;
    font-size: 0.62rem; font-weight: 700; color: #111; background: #6b7280; }
  .jt0 { background: #6b7280; } .jt1 { background: #c79a3c; }
  .jt2 { background: #e8b730; } .jt3 { background: #3fb6d0; } .jt4 { background: #d6552f; }
  .id { flex: 1; }
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
