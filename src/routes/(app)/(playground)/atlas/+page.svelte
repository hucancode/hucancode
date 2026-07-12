<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Catalog from "$lib/components/mech-catalog.svelte";
  import Sliders from "$lib/components/mech-sliders.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { ATLAS_KIT } from "$lib/mech/atlas/parts.js";
  import {
    atlasModel, atlasHeight, atlasPose, atlasMontages, baseChan,
    ATLAS_POSE_DEPTH, SIDE_CHANNELS, SIDES,
  } from "$lib/mech/atlas/rig.js";
  import { assembleModel } from "$lib/mech/build-anim.js";
  import { createChoreographer, CHOREO_TIMING } from "$lib/mech/choreo.js";

  let scene = $state(null);

  const ATLAS_PARTS = ATLAS_KIT.names;

  let view = $state("atlas");              // "joints" | "blocks" | "atlas"
  let asel = $state("rig");                // "rig" = the whole atlas, else a part
  let partsOpen = $state(false);           // the stage's part picker, shut by default
  let cmodel = $state(null);               // catalog tabs bind their model out
  let csel = $state("");                   // ...and their selection, for framing
  let aparams = $state(structuredClone(ATLAS_KIT.params));
  // The pose ALWAYS carries both flanks (`elbowL` / `elbowR`) — there is no
  // mirrored channel anywhere. MIRROR is a write rule laid over it: the sliders
  // and the choreographer touch the LEFT channels only, and `mirrorWrites` copies
  // every one of those onto the right as it lands. Drop the rule and the right
  // channels simply stay where the last mirrored write left them, so the flanks
  // come apart from the pose they were already holding.
  let mirror = $state(true);
  let arig = $state(atlasPose());                    // atlas rig pose, L/R keyed
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

  const PART_LABELS = { upperArm: "upper arm", armWave: "arm wave", frontWave: "front wave", verticalWave: "vertical wave" };
  // routines the mirror rule can't hold come through as `frontWaveOpposed` — the
  // same wave, the two arms parked in opposite setups
  const montageLabel = (name) => {
    const base = name.replace(/Opposed$/, "");
    return (PART_LABELS[base] ?? base) + (base === name ? "" : " opposed");
  };
  // every routine is a wave, so they all wear the same glyph and are told apart by
  // their number; the written name rides along as the tooltip and accessible name.
  // The numbering follows the montage order, so it shifts when the opposed pairs
  // come and go with the split.
  const MONTAGE_ICON = (i) => `🌊${i + 1}`;
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
  // rig runtime controls (all degrees, straight onto the bones), written once per
  // limb — `sided` puts them on the rig's real per-flank channels
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
  // Rows onto the rig's real channels: every limb row forks into `arm raise L` /
  // `arm raise R`, two sliders on two bones, and both are always on show. While
  // mirroring, the right ones are LOCKED rather than dropped — they are not
  // steered, they are copied, and watching them track the left flank is the whole
  // point of seeing them.
  const SIDED = new Set(SIDE_CHANNELS);
  // rows onto the channels a WRITER may name: mirroring, a limb row lands on the
  // left channel alone (the right one follows by copy); split, it forks in two
  const sided = (ctl, mir) =>
    ctl.flatMap(([key, label, ...rest]) =>
      !SIDED.has(key) ? [[key, label, ...rest]]
        : mir ? [[key + "L", label, ...rest]]
          : SIDES.map((S) => [key + S, `${label} ${S}`, ...rest]),
    );
  const rigCtl = $derived(
    ATLAS_CTL.flatMap(([key, label, ...rest]) =>
      !SIDED.has(key) ? [[key, label, ...rest]]
        : SIDES.map((S) => [key + S, `${label} ${S}`, ...rest]),
    ),
  );
  // the right flank's channels, while the mirror rule owns them
  const rigLocked = $derived(
    new Set(mirror ? SIDE_CHANNELS.map((key) => key + "R") : []),
  );
  const montages = $derived(atlasMontages(mirror));
  // every write to a left channel is echoed onto the right one, so a mirrored
  // slider (or a mirrored beat) moves both arms while only ever naming one
  const mirrorWrites = (pose) => new Proxy(pose, {
    set(t, key, v) {
      t[key] = v;
      if (typeof key === "string" && key.endsWith("L") && SIDED.has(baseChan(key)))
        t[baseChan(key) + "R"] = v;
      return true;
    },
  });
  // the object the sliders and the choreographer write through: bare while the
  // flanks are apart, mirror-echoing while they move as one
  const poseIn = $derived(mirror ? mirrorWrites(arig) : arig);
  // choreographer slider kit: the bone depth of a channel says how much mass it
  // moves, so the shallow ones (waist, shoulder, neck) are the big beats and
  // everything below them (elbow, wrist, fingers) is small detail. The legs sit
  // it out — the figure has to keep standing. Split, every limb channel enters
  // twice, so a beat can pick the left elbow and leave the right one alone.
  const BIG_DEPTH = 2;
  const CHOREO_SKIP = new Set(["hip", "knee"]);
  const choreoSliders = $derived(
    sided(ATLAS_CTL.filter(([key]) => !CHOREO_SKIP.has(key)), mirror)
      .map(([key, , min, max]) => ({ key, min, max, big: ATLAS_POSE_DEPTH[key] <= BIG_DEPTH })),
  );
  // the waist ball's three channels share one joint: let each swing freely and
  // the torso folds through the pelvis, so only ever activate one of them
  const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];
  // beat timing knobs — the anticipation and rest slices bracket the main move,
  // so neither may eat the whole period
  const CHOREO_CTL = [
    ["period", "beat", 0.3, 3, 0.1],
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
    ["switchChance", "side switch", 0, 0.5, 0.01],
  ];

  function resetPart() { aparams[asel] = structuredClone(ATLAS_KIT.params[asel]); }
  function resetAtlas() { arig = atlasPose(); }
  // Take the flanks apart, or put them back together. Nothing is rekeyed — the
  // pose already holds both — so all that changes is who writes the right
  // channels. Clamping the mirror back ON copies the left flank over the right at
  // once, so the figure snaps square instead of holding a pose half the sliders
  // no longer name.
  function toggleMirror() {
    mirror = !mirror;
    if (mirror) for (const key of SIDE_CHANNELS) arig[key + "R"] = arig[key + "L"];
  }
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
    const cho = createChoreographer(choreoSliders, {
      home: atlasPose(), montages, exclusives: CHOREO_EXCLUSIVE, seed,
      // a beat may take the flanks apart (or put them back together) on its own;
      // the slider set changes under it, so this effect rebuilds it
      onSwitch: toggleMirror,
      ...$state.snapshot(ctiming),
    });
    // the beat writes through the same mirror rule the sliders do: while mirrored
    // it only ever names left channels, and the right flank follows
    const pose = poseIn;
    const stop = driveRaf((dt) => cho.step(dt, pose));
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
    {#if view === "atlas"}
      <menu>
        <li>
          <button type="button" aria-pressed={partsOpen} title="parts"
            onclick={() => (partsOpen = !partsOpen)}>🧩</button>
        </li>
        {#if partsOpen}
          <li><button type="button" aria-pressed={asel === "rig"}
            onclick={() => (asel = "rig")}>atlas</button></li>
          {#each ATLAS_PARTS as pn}
            <li><button type="button" aria-pressed={asel === pn}
              onclick={() => (asel = pn)}>{PART_LABELS[pn] ?? pn}</button></li>
          {/each}
        {/if}
      </menu>
    {/if}
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
      {#if asel === "rig"}
        <fieldset>
          <legend>choreo<button type="button" onclick={resetChoreo}>reset</button></legend>
          <label><input type="checkbox" bind:checked={choreo} /><span>autoplay</span></label>
          <Sliders ctl={CHOREO_CTL} values={ctiming} />
          <menu>
            {#each Object.keys(montages) as name, i}
              <li><button type="button" disabled={!live} onclick={() => live.play(name)}
                title={montageLabel(name)} aria-label={montageLabel(name)}>
                {MONTAGE_ICON(i)}</button></li>
            {/each}
          </menu>
        </fieldset>
        <fieldset>
          <legend>rig<button type="button" onclick={resetAtlas}>reset</button></legend>
          <label>
            <input type="checkbox" checked={!mirror} onchange={toggleMirror} />
            <span>split sides</span>
          </label>
          <Sliders ctl={rigCtl} values={poseIn} locked={rigLocked} />
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

<style>
  section > menu {
    top: 0.5rem;
    left: 0.5rem;
  }
  section > menu button {
    width: auto;
    min-width: 32px;
    padding: 0 0.5rem;
    border-radius: 0;
    border: 0;
  }
</style>
