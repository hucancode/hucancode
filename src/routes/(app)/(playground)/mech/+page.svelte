<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Catalog from "$lib/components/mech-catalog.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { DRAGON_KIT } from "$lib/mech/dragon/parts.js";
  import { dragonModel, DRAGON_POSE } from "$lib/mech/dragon/rig.js";
  import { assembleModel, BUILD_SECONDS } from "$lib/mech/build-anim.js";
  import Dragon from "$icons/simple-icons/dragon.svg?raw";

  const RENDER_CTL = [
    ["spin", "spin", 0, 3, 0.1],
    ["light", "light angle", 0, 6.28, 0.05],
  ];

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

  let render = $state({ spin: 0.3, light: 0.6 });

  const PART_LABELS = {
    bodySegment: "body segment", bodySegment2: "body segment 2",
    upperArm: "upper arm", forearm: "forearm",
  };
  // [key, label, min, max, step?] sliders per part — BODY shape only; every
  // joint lives in the joint catalog now, and every angle on a rig slider
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
  // offset slides the body along the loop curve; it's what autoplay drives
  const CHOREO_CTL = [["offset", "loop offset", 0, 1, 0.002]];
  const DRAGON_CTL = [
    ["jaw", "jaw open", 0, 45, 1],
    ["armSwing", "arm swing", -180, 180, 1],
    ["elbow", "elbow bend", 0, 70, 1],
    ["legSwing", "leg swing", -60, 60, 1],
    ["knee", "knee bend", 0, 60, 1],
  ];

  function resetPart() { dparams[dsel] = structuredClone(DRAGON_KIT.params[dsel]); }
  function resetDragon() { drig = structuredClone(DRAGON_POSE); }
  function shuffle() { seed = (seed + 1) | 0; }

  function playAssemble() { asm = 0; asmPlay = true; }

  const rigShown = $derived(view === "dragon" && dsel === "rig");

  const model = $derived.by(() => {
    if (view !== "dragon") return cmodel;
    if (dsel !== "rig") return DRAGON_KIT.partModel(dsel, seed, $state.snapshot(dparams)[dsel]);
    const m = dragonModel(seed, $state.snapshot(drig));
    if (asm >= 1) return m;
    return { ...m, items: assembleModel(m.items, asm) };
  });
  $effect(() => { scene?.apply({ spin: render.spin, lightAngle: render.light, model }); });
  // fixed per-view distance (no auto-fit): the dragon rides a big loop, single
  // parts and catalog blocks sit close in
  $effect(() => {
    csel;
    const dist = view !== "dragon" ? 6 : dsel === "rig" ? 24 : 6;
    scene?.apply({ resetView: true, dist });
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
  <Scene bind:this={scene} scene={mech} id="mech" onFrame={frame} />
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
        <li><input type="range" min="0" max="1" step="0.001" bind:value={asm} onpointerdown={() => (asmPlay = false)} /></li>
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
    {#each RENDER_CTL as [key, label, min, max, step]}
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
        {#each DRAGON_CTL as [key, label, min, max, step]}
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
</style>
