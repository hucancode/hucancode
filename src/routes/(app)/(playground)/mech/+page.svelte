<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Catalog from "$lib/components/mech-catalog.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import * as rt from "$lib/playgrounds/raytrace";
  import { DRAGON_KIT } from "$lib/mech/dragon/parts.js";
  import { dragonModel, DRAGON_POSE } from "$lib/mech/dragon/rig.js";
  // ---- dragon UI surface (inlined from $lib/ui/dragon.js) ----
// DRAGON UI SURFACE — the slider rows for the dragon playground's rig and part
// picker. The rig itself (links, spine solve, model) lives in lib/mech/dragon/rig.js
// and the part geometry in lib/mech/dragon/parts.js.
const DEG = Math.PI / 180;   // radian value of one degree, for writing constants

// rig pose sliders (radians in the engine, degrees in the UI)
const DRAGON_CTL = [
  ["jaw", "jaw open", 0, 45 * DEG, DEG],
  ["armSwing", "arm swing", -Math.PI, Math.PI, DEG],
  ["elbow", "elbow bend", 0, 70 * DEG, DEG],
  ["legSwing", "leg swing", -60 * DEG, 60 * DEG, DEG],
  ["knee", "knee bend", 0, 60 * DEG, DEG],
];
// offset slides the body along the loop curve (0..1); it's what autoplay drives
const LOOP_CTL = [["offset", "loop offset", 0, 1, 0.002]];

// ---- PART PICKER ------------------------------------------------------------
const PART_LABELS = {
  bodySegment: "body segment", bodySegment2: "body segment 2",
  upperArm: "upper arm", forearm: "forearm",
};

// [key, label, min, max, step?] sliders per part — BODY shape only
const PART_CTL = {
  head: [["headW", "head width", 0.7, 2.0], ["snoutLen", "snout length", 0.5, 2.0], ["eyeR", "eye radius", 0.08, 0.3], ["hornLen", "horn length", 0.1, 1.2]],
  jaw: [["jawW", "jaw width", 0.3, 1.2], ["jawLen", "jaw length", 0.6, 2.4]],
  bodySegment: [["bodyR", "body radius", 0.3, 0.9], ["segLen", "segment length", 0.8, 3.0], ["discs", "belly discs", 2, 7, 1], ["finR", "fin radius", 0.15, 0.8]],
  bodySegment2: [["rFront", "front radius", 0.25, 0.9], ["rRear", "rear radius", 0.15, 0.8], ["segLen", "segment length", 0.8, 3.0], ["finR", "fin radius", 0.15, 0.8]],
  upperArm: [["len", "length", 0.25, 1.2], ["w", "width", 0.2, 0.7]],
  forearm: [["len", "length", 0.2, 1.2], ["clawR", "claw radius", 0.15, 0.5]],
  thigh: [["len", "length", 0.25, 1.2], ["w", "width", 0.2, 0.8]],
  shin: [["len", "length", 0.2, 1.2], ["footLen", "foot length", 0.15, 0.9], ["clawR", "claw radius", 0.15, 0.5]],
  tail: [["coreLen", "core length", 0.6, 2.5], ["bodyR", "body radius", 0.2, 0.7], ["tipLen", "tip length", 0.4, 2.2]],
};
  const CHOREO_CTL = LOOP_CTL;
  import { rad, deg } from "$lib/math/scalar.js";
  import { assembleModel, BUILD_SECONDS } from "$lib/mech/build-anim.js";
  import Dragon from "$icons/simple-icons/dragon.svg?raw";

  let render = $state({
    spin: 0.3, light: 0.6, wire: 0,
    raytrace: false, exposure: 1.1, softness: 0.08, quality: 1.0, raycount: 1,
  });

  const RENDER_CTL = [
    ["spin", "spin", 0, 3, 0.1],
    ["light", "light angle", 0, 6.28, 0.05],
    ["wire", "wireframe", 0, 1],
  ];
  const RT_CTL = [
    ["light", "light angle", 0, 6.28, 0.05],
    ["exposure", "exposure", 0.2, 3, 0.05],
    ["softness", "shadow softness", 0, 0.3, 0.005],
    ["quality", "resolution", 0.15, 1, 0.05],
    ["raycount", "ray count", 1, 16, 1],
  ];
  const renderCtl = $derived(render.raytrace ? RT_CTL : RENDER_CTL);
  const engine = $derived(render.raytrace ? rt : mech);

  // raytracer material slots — the dragon's links fold onto one picker entry each
  const MATERIAL_TYPES = ["lambertian", "metal", "dielectric"];
  const RT_PARTS = [
    ["head", "head"], ["jaw", "jaw"], ["body", "body"], ["taper", "taper"],
    ["tail", "tail"], ["upperArm", "upper arm"], ["forearm", "forearm"],
    ["thigh", "thigh"], ["shin", "shin"],
  ];
  const DEFAULT_MATERIALS = {
    head: { type: "dielectric", ior: 1.5 },
    jaw: { type: "metal", fuzz: 0.1 },
    body: { type: "lambertian", roughness: 0.3 },
    taper: { type: "lambertian", roughness: 0.3 },
    tail: { type: "lambertian", roughness: 0.3 },
    upperArm: { type: "metal", fuzz: 0.1 },
    forearm: { type: "lambertian", roughness: 0.3 },
    thigh: { type: "lambertian", roughness: 0.3 },
    shin: { type: "metal", fuzz: 0.1 },
  };
  let materials = $state(structuredClone(DEFAULT_MATERIALS));
  const PART_OF_GROUP = (group) => {
    const link = group ? group.slice(0, group.indexOf(":")) : "";
    if (link === "head") return "head";
    if (link === "jaw") return "jaw";
    if (link === "tail") return "tail";
    if (link === "seg7" || link.startsWith("taper")) return "taper";
    if (link.startsWith("seg")) return "body";
    if (link.startsWith("fore")) return "forearm";
    if (link.startsWith("arm")) return "upperArm";
    if (link.startsWith("leg")) return "thigh";
    if (link.startsWith("shin")) return "shin";
    return link;
  };
  function setMatType(key, type) {
    const next = { type };
    if (type === "lambertian") next.roughness = 0.3;
    if (type === "metal") next.fuzz = 0.1;
    if (type === "dielectric") next.ior = 1.5;
    materials = { ...materials, [key]: next };
  }
  function setMatParam(key, field, value) {
    materials = { ...materials, [key]: { ...materials[key], [field]: value } };
  }
  let stats = $state({ instances: 0, nodes: 0, buildMs: 0, traceMs: 0, fps: 0, samples: 0 });

  let scene = $state(null);
  let partsOpen = $state(false); // stage part picker, shut by default

  const DRAGON_PARTS = DRAGON_KIT.names;

  let view = $state("dragon");             // "joints" | "blocks" | "dragon"
  let dsel = $state("rig");                // "rig" = the whole dragon, else a part
  let cmodel = $state(null);               // catalog tabs bind their model out
  let csel = $state("");                   // ...and their selection, for framing
  let dparams = $state(structuredClone(DRAGON_KIT.params));
  let drig = $state(structuredClone(DRAGON_POSE));   // dragon rig pose
  let autoplay = $state(true);                       // fly the loop automatically
  const LAP_SECONDS = 4;
  // assembly build scrub: 1 = fully assembled, <1 runs the 4-phase build
  let asm = $state(1);
  let asmPlay = $state(false);
  let seed = $state(1);                    // color shuffle seed

  // rig pose sliders are radians in the engine, degrees in the UI; the loop
  // offset (CHOREO_CTL) is a 0..1 ratio and passes
  // through untouched
  const rigRows = $derived(DRAGON_CTL.map(([key, label, min, max, step]) =>
    [key, label, deg(min), deg(max), step ? deg(step) : 0.01]));
  const rigVal = (key) => deg(drig[key]);
  const rigSet = (key, v) => { drig[key] = rad(+v); };

  function resetPart() { dparams[dsel] = structuredClone(DRAGON_KIT.params[dsel]); }
  function resetDragon() { drig = structuredClone(DRAGON_POSE); }
  function shuffle() { seed = (seed + 1) | 0; }

  function playAssemble() { asmCache.clear(); asmOff0 = drig.offset; asm = 0; asmPlay = true; }
  // scrub start: freeze the ride offset the current build clock implies, so
  // the anchors stay world-fixed while dragging even though autoplay keeps
  // moving the body
  function grabAsm() {
    asmPlay = false;
    asmOff0 = drig.offset - asm * (autoplay ? BUILD_SECONDS / LAP_SECONDS : 0);
  }

  // frozen WORLD anchors for the build: groups form at the pose the body had
  // when they started, then convert to the local frame for the dock flight.
  // asmOff0 = the ride offset at build start, captured ONCE per build/scrub —
  // deriving it from the live offset each frame would drag the anchors along
  // with the body (local-space build) whenever the two clocks decouple.
  // Cached per anchor pose — anchors are per-group constants, so steady
  // state is pure cache hits.
  let asmOff0 = DRAGON_POSE.offset;
  const asmCache = new Map();
  function asmRefAt(pose, dOff) {
    const off0 = asmOff0;
    return (uu) => {
      const off = (((off0 + uu * dOff) % 1) + 1) % 1;
      const key = [seed, off.toFixed(5), pose.jaw, pose.armSwing, pose.elbow, pose.legSwing, pose.knee].join("|");
      if (!asmCache.has(key)) {
        if (asmCache.size > 200) asmCache.clear();
        asmCache.set(key, dragonModel(seed, { ...pose, offset: off }).items);
      }
      return asmCache.get(key);
    };
  }

  const rigShown = $derived(view === "dragon" && dsel === "rig");

  const model = $derived.by(() => {
    if (view !== "dragon") return cmodel;
    if (dsel !== "rig") return DRAGON_KIT.partModel(dsel, seed, $state.snapshot(dparams)[dsel]);
    const pose = $state.snapshot(drig);
    const m = dragonModel(seed, pose);
    if (asm >= 1) return m;
    const dOff = autoplay ? BUILD_SECONDS / LAP_SECONDS : 0;
    return { ...m, items: assembleModel(m.items, asm, asmRefAt(pose, dOff)) };
  });
  $effect(() => {
    scene?.apply({
      spin: render.spin,
      lightAngle: render.light,
      wire: render.wire,
      model,
      ...(render.raytrace ? {
        light: render.light,
        exposure: render.exposure,
        softness: render.softness,
        quality: render.quality,
        raycount: render.raycount,
        materials,
        partKey: PART_OF_GROUP,
      } : {}),
    });
  });
  // fixed per-view distance (no auto-fit): the dragon rides a big loop, single
  // parts and catalog blocks sit close in
  $effect(() => {
    csel;
    engine;   // reframe the swapped-in renderer on the same view
    const dist = view !== "dragon" ? 6 : dsel === "rig" ? 24 : 6;
    scene?.apply({ resetView: true, dist });
  });
  $effect(() => {
    if (!render.raytrace) return;
    const t = setInterval(() => {
      stats = rt.getStats();
      stats.instances = model?.items?.length ?? 0;
    }, 400);
    return () => clearInterval(t);
  });
  // every page clock runs off the canvas's frame, so they pause with it
  function frame(dt) {
    if (!rigShown) return;
    if (autoplay) drig.offset = (drig.offset + dt / LAP_SECONDS) % 1;
    if (asmPlay) {
      asm = Math.min(1, asm + dt / BUILD_SECONDS);
      if (asm >= 1) asmPlay = false;
    }
  }
</script>

<svelte:head><title>Mech</title></svelte:head>

<section>
  <Scene bind:this={scene} scene={engine} id="mech" onFrame={frame}
    onError={() => (render.raytrace = false)} />
  {#if view === "dragon"}
    <menu>
      <li>
        <button type="button" aria-pressed={partsOpen} title="parts" aria-label="parts"
          onclick={() => (partsOpen = !partsOpen)}>{@html Dragon}</button>
      </li>
      {#if partsOpen}
        <li><button type="button" aria-pressed={dsel === "rig"}
          onclick={() => (dsel = "rig")}>dragon</button></li>
        {#each DRAGON_PARTS as pn}
          <li><button type="button" aria-pressed={dsel === pn}
            onclick={() => (dsel = pn)}>{PART_LABELS[pn] ?? pn}</button></li>
        {/each}
      {/if}
    </menu>
  {/if}
  {#if rigShown}
    <footer>
      <menu>
        <li><button type="button" onclick={playAssemble}>▶ Assemble</button></li>
        <li><input type="range" min="0" max="1" step="0.001" bind:value={asm} onpointerdown={grabAsm} /></li>
        <li><output>{asm.toFixed(2)}</output></li>
      </menu>
    </footer>
  {/if}
</section>

<aside>
  <fieldset>
    <legend>view</legend>
    <menu role="group">
      <li><label><input type="radio" name="mech-view" value="joints" bind:group={view} />joints</label></li>
      <li><label><input type="radio" name="mech-view" value="blocks" bind:group={view} />blocks</label></li>
      <li><label><input type="radio" name="mech-view" value="dragon" bind:group={view} />dragon</label></li>
    </menu>
  </fieldset>

  <fieldset>
    <legend>render</legend>
    <label><input type="checkbox" checked={render.raytrace}
      onchange={(e) => (render.raytrace = e.currentTarget.checked)} /><span>ray tracing</span></label>
    {#each renderCtl as [key, label, min, max, step]}
      {#if min === 0 && max === 1 && step === 1}
        <label><input type="checkbox" checked={!!render[key]}
          onchange={(e) => (render[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
      {:else}
        <label><span>{label}</span>
          <input type="range" {min} {max} step={step ?? 0.01} value={render[key]}
            oninput={(e) => (render[key] = +e.currentTarget.value)} />
          <output>{render[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
      {/if}
    {/each}
    <menu><li><button type="button" onclick={shuffle}>new color</button></li></menu>
  </fieldset>
  {#if render.raytrace}
    {#if view === "dragon" && dsel === "rig"}
      <fieldset>
        <legend>materials</legend>
        <ul class="mats">
          {#each RT_PARTS as [key, label]}
            <li class="mat-row">
              <span class="mat-name">{label}</span>
              <select value={materials[key].type} onchange={(e) => setMatType(key, e.currentTarget.value)}>
                {#each MATERIAL_TYPES as mt}<option value={mt}>{mt}</option>{/each}
              </select>
              {#if materials[key].type === "metal"}
                <input type="range" min="0" max="0.5" step="0.01" value={materials[key].fuzz}
                  oninput={(e) => setMatParam(key, "fuzz", +e.currentTarget.value)} title="fuzz" />
              {:else if materials[key].type === "dielectric"}
                <input type="range" min="1" max="2.5" step="0.01" value={materials[key].ior}
                  oninput={(e) => setMatParam(key, "ior", +e.currentTarget.value)} title="ior" />
              {:else}
                <input type="range" min="0" max="1" step="0.01" value={materials[key].roughness}
                  oninput={(e) => setMatParam(key, "roughness", +e.currentTarget.value)} title="roughness" />
              {/if}
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}
    <fieldset>
      <legend>stats</legend>
      <dl>
        <dt>primitives</dt><dd>{stats.instances}</dd>
        <dt>bvh nodes</dt><dd>{stats.nodes}</dd>
        <dt>bvh build</dt><dd>{stats.buildMs.toFixed(2)} ms</dd>
        <dt>trace</dt><dd>{stats.traceMs.toFixed(1)} ms</dd>
        <dt>samples</dt><dd>{stats.samples}</dd>
        <dt>fps</dt><dd>{stats.fps || 0}</dd>
      </dl>
    </fieldset>
  {/if}

  {#if view === "dragon"}
    {#if dsel === "rig"}
      <fieldset>
        <legend>choreo</legend>
        <label><input type="checkbox" bind:checked={autoplay} /><span>autoplay</span></label>
        {#each CHOREO_CTL as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!drig[key]}
              onchange={(e) => (drig[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={drig[key]}
                oninput={(e) => (drig[key] = +e.currentTarget.value)} />
              <output>{drig[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
      </fieldset>
      <fieldset>
        <legend>rig<button type="button" onclick={resetDragon}>reset</button></legend>
        {#each rigRows as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!drig[key]}
              onchange={(e) => (drig[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={rigVal(key)}
                oninput={(e) => rigSet(key, e.currentTarget.value)} />
              <output>{rigVal(key).toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
      </fieldset>
    {:else}
      <fieldset>
        <legend>params<button type="button" onclick={resetPart}>reset</button></legend>
        {#each PART_CTL[dsel] as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!dparams[dsel][key]}
              onchange={(e) => (dparams[dsel][key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={dparams[dsel][key]}
                oninput={(e) => (dparams[dsel][key] = +e.currentTarget.value)} />
              <output>{dparams[dsel][key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
      </fieldset>
    {/if}
  {:else}
    <Catalog {view} {seed} bind:model={cmodel} bind:sel={csel} />
  {/if}
</aside>

<style>
  section > menu { top: 0.5rem; left: 0.5rem; }
  /* part names ride in the same pill menu as the toggle icon: as wide as their label */
  section > menu button { width: auto; padding: 0 0.5rem; }
  /* the icon comes in through {@html}, so the scoping attribute never lands on it */
  section > menu button :global(svg) { width: 20px; height: 20px; display: block; }

  dl { display: grid; grid-template-columns: auto 1fr; gap: 0.15rem 0.75rem; margin: 0; font-size: 0.85rem; }
  dt { opacity: 0.6; }
  dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
  ul.mats { display: grid; gap: 0.4rem; }
  li.mat-row { display: flex; align-items: center; gap: 0.4rem; }
  .mat-name { flex: 1; font-size: 0.8rem; opacity: 0.85; }
  li.mat-row select { flex: none; max-width: 6.5rem; font-size: 0.8rem; }
  li.mat-row input[type="range"] { flex: 1; max-width: 5.5rem; }
</style>
