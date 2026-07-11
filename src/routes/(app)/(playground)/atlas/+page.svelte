<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Catalog from "$lib/components/mech-catalog.svelte";
  import Sliders from "$lib/components/mech-sliders.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { ATLAS_KIT } from "$lib/mech/atlas/parts.js";
  import { atlasModel, atlasHeight, ATLAS_POSE, ATLAS_POSE_DEPTH, ATLAS_MONTAGES } from "$lib/mech/atlas/rig.js";
  import { assembleModel } from "$lib/mech/build-anim.js";
  import { createChoreographer, CHOREO_TIMING } from "$lib/mech/choreo.js";

  let scene = $state(null);

  const ATLAS_PARTS = ATLAS_KIT.names;

  let view = $state("atlas");              // "joints" | "blocks" | "atlas"
  let asel = $state("rig");                // "rig" = the whole atlas, else a part
  let cmodel = $state(null);               // catalog tabs bind their model out
  let csel = $state("");                   // ...and their selection, for framing
  let aparams = $state(structuredClone(ATLAS_KIT.params));
  let arig = $state(structuredClone(ATLAS_POSE));    // atlas rig pose
  let choreo = $state(true);                         // procedural beats
  let ctiming = $state(structuredClone(CHOREO_TIMING));   // beat timing
  let live = $state(null);   // the running choreographer, null while it is off
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

  const PART_LABELS = { upperArm: "upper arm", armWave: "arm wave", frontWave: "front wave", reverseWave: "reverse wave" };
  // [key, label, min, max, step?] sliders per part
  const PART_CTL = {
    head: [["headR", "head radius", 0.18, 0.45], ["headD", "head depth", 0.3, 0.9], ["innerR", "inner ring radius", 0.06, 0.35]],
    torso: [["chestW", "chest width", 0.7, 1.6], ["chestH", "chest height", 0.5, 1.4], ["chestD", "chest depth", 0.4, 1.0]],
    pelvis: [["hipW", "disc width", 0.5, 1.3], ["hipH", "dome radius", 0.15, 0.5]],
    upperArm: [["len", "length", 0.2, 0.9], ["w", "width", 0.15, 0.5]],
    forearm: [["len", "length", 0.2, 0.9], ["w", "width", 0.12, 0.45]],
    palm: [["w", "width", 0.15, 0.5], ["h", "height", 0.15, 0.5], ["d", "depth", 0.12, 0.45]],
    digit: [["len", "digit length", 0.1, 0.4], ["w", "width", 0.05, 0.2]],
    thigh: [["len", "length", 0.3, 1.1], ["w", "width", 0.2, 0.6]],
    shin: [["len", "length", 0.3, 1.0], ["w", "width", 0.15, 0.5]],
    foot: [["len", "length", 0.3, 1.0], ["w", "width", 0.2, 0.5], ["heelD", "heel depth", 0.08, 0.4], ["heelCapD", "heel taper depth", 0.06, 0.35]],
  };
  // rig runtime controls (all degrees, straight onto the bones)
  const ATLAS_CTL = [
    ["headYaw", "head yaw", -180, 180, 1],
    ["headPitch", "head pitch", -30, 30, 1],
    ["twist", "waist twist", -180, 180, 1],
    ["waistBend", "waist bend", -45, 45, 1],
    ["waistTilt", "waist tilt", -45, 45, 1],
    ["shoulder", "arm swing", -180, 180, 1],
    ["armOut", "arm raise", -10, 180, 1],
    ["armTwist", "arm twist", -180, 180, 1],
    ["elbow", "elbow bend", -90, 90, 1],
    ["foreTwist", "forearm twist", -180, 180, 1],
    ["wristBend", "wrist bend", -100, 100, 1],
    ["wristTilt", "wrist tilt", -100, 100, 1],
    ["wristTwist", "wrist twist", -180, 180, 1],
    ["curl", "finger curl", -30, 60, 1],
    ["hip", "leg swing", -45, 45, 1],
    ["knee", "knee bend", 0, 60, 1],
  ];
  // choreographer slider kit: the bone depth of a channel says how much mass it
  // moves, so the shallow ones (waist, shoulder, neck) are the big beats and
  // everything below them (elbow, wrist, fingers) is small detail. The legs sit
  // it out — the figure has to keep standing.
  const BIG_DEPTH = 2;
  const CHOREO_SKIP = new Set(["hip", "knee"]);
  const CHOREO_SLIDERS = ATLAS_CTL
    .filter(([key]) => !CHOREO_SKIP.has(key))
    .map(([key, , min, max]) => ({ key, min, max, big: ATLAS_POSE_DEPTH[key] <= BIG_DEPTH }));
  // the waist ball's three channels share one joint: let each swing freely and
  // the torso folds through the pelvis, so only ever activate one of them
  const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];
  // beat timing knobs — the anticipation and rest slices bracket the main move,
  // so neither may eat the whole period
  const CHOREO_CTL = [
    ["period", "beat", 0.3, 6, 0.1],
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
  ];

  function resetPart() { aparams[asel] = structuredClone(ATLAS_KIT.params[asel]); }
  function resetAtlas() { arig = structuredClone(ATLAS_POSE); }
  function resetChoreo() { ctiming = structuredClone(CHOREO_TIMING); }
  function shuffle() { seed = (seed + 1) | 0; }
  function playAssemble() { asm = 0; asmPlay = true; }

  const rigShown = $derived(view === "atlas" && asel === "rig");

  const model = $derived.by(() => {
    if (view !== "atlas") return cmodel;
    if (asel !== "rig") return ATLAS_KIT.partModel(asel, seed, $state.snapshot(aparams)[asel]);
    const m = atlasModel(seed, $state.snapshot(arig));
    if (asm >= 1) return m;
    // static body: no ride curve, the live items are their own anchors
    return { ...m, items: assembleModel(m.items, asm) };
  });
  $effect(() => { scene?.apply({ spin: render.spin }); });
  $effect(() => { scene?.apply({ lightAngle: render.light }); });
  $effect(() => { scene?.apply({ model }); });
  // fixed per-view distance (no auto-fit): single-part previews use a per-part
  // catalog distance — the atlas kit has much smaller pieces than the dragon's
  const PART_DIST = {
    digit: 2.5, palm: 3, forearm: 3.5, upperArm: 3.5,
    head: 3.5, foot: 3.5, shin: 4, thigh: 4, pelvis: 4, torso: 5.5,
  };
  // the atlas stands ON the grid, so the whole rig sits above y=0: the camera
  // has to look at its waist, not at the origin. Parts sit on their own origin.
  const rigView = $derived(view === "atlas" && asel === "rig");
  $effect(() => {
    csel;
    const dist = view !== "atlas" ? 6 : rigView ? 12 : PART_DIST[asel] ?? 6;
    scene?.apply({ resetView: true, dist, lookY: rigView ? atlasHeight(seed) / 2 : 0 });
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
  // choreographer: rewrite the atlas pose in place every frame, so the rig
  // sliders visibly ride the beat
  $effect(() => {
    if (!choreo || !rigShown) return;
    // a timing edit restarts the beat — the tracks it planned are cut to the
    // old period, so there is nothing to carry over
    const cho = createChoreographer(CHOREO_SLIDERS, {
      home: ATLAS_POSE, montages: ATLAS_MONTAGES, exclusives: CHOREO_EXCLUSIVE, seed,
      ...$state.snapshot(ctiming),
    });
    const stop = driveRaf((dt) => cho.step(dt, arig));
    live = cho;
    return () => { live = null; stop(); };
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

<svelte:head><title>Atlas</title></svelte:head>

  <section>
    <Scene bind:this={scene} scene={mech} id="atlas" />
    {#if rigShown}
      <footer>
        <div>
          <button type="button" onclick={playAssemble}>▶ Assemble</button>
          <input type="range" min="0" max="1" step="0.001" bind:value={asm} onpointerdown={() => (asmPlay = false)} />
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
        <label><input type="radio" name="mech-view" value="atlas" bind:group={view} />atlas</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>render</legend>
      <Sliders ctl={RENDER_CTL} values={render} />
      <menu><li><button type="button" onclick={shuffle}>new color</button></li></menu>
    </fieldset>

    {#if view === "atlas"}
      <fieldset>
        <legend>parts</legend>
        <ul>
          <li><label><input type="radio" name="atlas-part" value="rig" bind:group={asel} />atlas</label></li>
          {#each ATLAS_PARTS as pn}
            <li><label><input type="radio" name="atlas-part" value={pn} bind:group={asel} />{PART_LABELS[pn] ?? pn}</label></li>
          {/each}
        </ul>
      </fieldset>
      {#if asel === "rig"}
        <fieldset>
          <legend>choreo<button type="button" onclick={resetChoreo}>reset</button></legend>
          <label><input type="checkbox" bind:checked={choreo} /><span>autoplay</span></label>
          <Sliders ctl={CHOREO_CTL} values={ctiming} />
          <ul>
            {#each Object.keys(ATLAS_MONTAGES) as name}
              <li><button type="button" disabled={!live} onclick={() => live.play(name)}>
                ▶ {PART_LABELS[name] ?? name}</button></li>
            {/each}
          </ul>
        </fieldset>
        <fieldset>
          <legend>rig<button type="button" onclick={resetAtlas}>reset</button></legend>
          <Sliders ctl={ATLAS_CTL} values={arig} />
        </fieldset>
      {:else}
        <fieldset>
          <legend>params<button type="button" onclick={resetPart}>reset</button></legend>
          <Sliders ctl={PART_CTL[asel]} values={aparams[asel]} />
        </fieldset>
      {/if}
    {:else}
      <Catalog {view} {seed} bind:model={cmodel} bind:sel={csel} />
    {/if}
  </aside>
