<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Catalog from "$lib/components/mech-catalog.svelte";
  import Sliders from "$lib/components/mech-sliders.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { DRAGON_KIT } from "$lib/mech/dragon/parts.js";
  import { dragonModel, DRAGON_POSE } from "$lib/mech/dragon/rig.js";
  import { assembleModel } from "$lib/mech/assembly.js";

  let scene = $state(null);

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
  const BUILD_SECONDS = 6;
  let seed = $state(1);                    // color shuffle seed

  let render = $state({ spin: 0.3, light: 0.6 });
  const RENDER_CTL = [
    ["spin", "spin", 0, 3, 0.1],
    ["light", "light angle", 0, 6.28, 0.05],
  ];

  const PART_LABELS = { bodySegment: "body segment", bodySegment2: "body segment 2" };
  // [key, label, min, max, step?] sliders per part
  const PART_CTL = {
    head: [["headW", "head width", 0.7, 2.0], ["snoutLen", "snout length", 0.5, 2.0], ["jawOpen", "jaw open", 0, 45], ["eyeR", "eye radius", 0.08, 0.3], ["hornLen", "horn length", 0.1, 1.2]],
    bodySegment: [["bodyR", "body radius", 0.3, 0.9], ["segLen", "segment length", 0.8, 3.0], ["discs", "belly discs", 2, 7, 1], ["finR", "fin radius", 0.15, 0.8]],
    bodySegment2: [["rFront", "front radius", 0.25, 0.9], ["rRear", "rear radius", 0.15, 0.8], ["segLen", "segment length", 0.8, 3.0], ["finR", "fin radius", 0.15, 0.8]],
    arm: [["upperLen", "upper arm", 0.25, 1.2], ["foreLen", "forearm", 0.2, 1.2], ["elbowBend", "elbow bend", 0, 70], ["clawR", "claw radius", 0.15, 0.5]],
    leg: [["thighLen", "thigh", 0.25, 1.2], ["shinLen", "shin", 0.2, 1.2], ["kneeBend", "knee bend", 0, 60], ["footLen", "foot length", 0.15, 0.9], ["clawR", "claw radius", 0.15, 0.5]],
    tail: [["coreLen", "core length", 0.6, 2.5], ["bodyR", "body radius", 0.2, 0.7], ["tipLen", "tip length", 0.4, 2.2]],
  };
  // rig runtime controls — offset slides the body along the loop curve
  const DRAGON_CTL = [
    ["offset", "loop offset", 0, 1, 0.002],
    ["jaw", "jaw open", 0, 45, 1],
    ["armSwing", "arm swing", -180, 180, 1],
    ["elbow", "elbow bend", 0, 70, 1],
    ["legSwing", "leg swing", -60, 60, 1],
    ["knee", "knee bend", 0, 60, 1],
  ];

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
  $effect(() => { scene?.apply({ spin: render.spin }); });
  $effect(() => { scene?.apply({ lightAngle: render.light }); });
  $effect(() => { scene?.apply({ model }); });
  // fixed per-view distance (no auto-fit): the dragon rides a big loop, single
  // parts and catalog blocks sit close in
  $effect(() => {
    csel;
    const dist = view !== "dragon" ? 6 : dsel === "rig" ? 24 : 6;
    scene?.apply({ resetView: true, dist });
  });
  // dt-clamped rAF driver; step returns false to stop
  const driveRaf = (step) => {
    let raf, last = performance.now();
    const tick = (t) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      if (step(dt) === false) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  };
  // autoplay: advance the loop offset each frame while enabled
  $effect(() => {
    if (!autoplay || !rigShown) return;
    return driveRaf((dt) => {
      drig.offset = (drig.offset + dt / LAP_SECONDS) % 1;
    });
  });
  // replay build: sweep the assembly scrub 0 -> 1 once
  $effect(() => {
    if (!asmPlay || !rigShown) return;
    return driveRaf((dt) => {
      asm = Math.min(1, asm + dt / BUILD_SECONDS);
      if (asm >= 1) { asmPlay = false; return false; }
    });
  });
</script>

<svelte:head><title>Mech</title></svelte:head>

  <section>
    <Scene bind:this={scene} scene={mech} id="mech" />
    {#if rigShown}
      <footer>
        <div>
          <button type="button" onclick={playAssemble}>▶ Assemble</button>
          <input type="range" min="0" max="1" step="0.001" bind:value={asm} onpointerdown={grabAsm} />
          <output>{asm.toFixed(2)}</output>
        </div>
      </footer>
    {/if}
  </section>

  <aside>
    <fieldset>
      <legend>view</legend>
      <div role="group">
        <label><input type="radio" name="mech-view" value="joints" bind:group={view} />joints</label>
        <label><input type="radio" name="mech-view" value="blocks" bind:group={view} />blocks</label>
        <label><input type="radio" name="mech-view" value="dragon" bind:group={view} />dragon</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>render</legend>
      <Sliders ctl={RENDER_CTL} values={render} />
      <menu><li><button type="button" onclick={shuffle}>new color</button></li></menu>
    </fieldset>

    {#if view === "dragon"}
      <fieldset>
        <legend>parts</legend>
        <ul>
          <li><label><input type="radio" name="dragon-part" value="rig" bind:group={dsel} />dragon</label></li>
          {#each DRAGON_PARTS as pn}
            <li><label><input type="radio" name="dragon-part" value={pn} bind:group={dsel} />{PART_LABELS[pn] ?? pn}</label></li>
          {/each}
        </ul>
      </fieldset>
      {#if dsel === "rig"}
        <fieldset>
          <legend>choreo</legend>
          <label><input type="checkbox" bind:checked={autoplay} /><span>autoplay</span></label>
        </fieldset>
        <fieldset>
          <legend>rig<button type="button" onclick={resetDragon}>reset</button></legend>
          <Sliders ctl={DRAGON_CTL} values={drig} />
        </fieldset>
      {:else}
        <fieldset>
          <legend>params<button type="button" onclick={resetPart}>reset</button></legend>
          <Sliders ctl={PART_CTL[dsel]} values={dparams[dsel]} />
        </fieldset>
      {/if}
    {:else}
      <Catalog {view} {seed} bind:model={cmodel} bind:sel={csel} />
    {/if}
  </aside>
