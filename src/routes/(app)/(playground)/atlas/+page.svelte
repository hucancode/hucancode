<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import Sliders from "$lib/components/mech-sliders.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { ATLAS_KIT } from "$lib/mech/atlas/parts.js";
  import {
    atlasModel, atlasHeight, atlasPose, atlasMontages, baseChan,
    ATLAS_POSE_DEPTH, SIDE_CHANNELS, SIDES,
  } from "$lib/mech/atlas/rig.js";
  import { assembleModel } from "$lib/mech/build-anim.js";
  import { createChoreographer, CHOREO_TIMING, CHOREO_STYLES } from "$lib/mech/choreo.js";
  import {
    createMusic, MUSIC_DEFAULTS, MUSIC_STYLE_NAMES, MUSIC_ROOT_NAMES, MUSIC_SCALE_NAMES, styleOf,
  } from "$lib/audio/music.js";
  import VolumeUp from "$icons/google-material/volume-up.svg?raw";
  import VolumeOff from "$icons/google-material/volume-off.svg?raw";
  import Bot from "$icons/carbon/bot.svg?raw";

  let scene = $state(null);

  const ATLAS_PARTS = ATLAS_KIT.names;

  let tab = $state("rig");                 // which panel the aside is showing
  let asel = $state("rig");                // "rig" = the whole atlas, else a part
  let partsOpen = $state(false);           // the stage's part picker, shut by default
  let aparams = $state(structuredClone(ATLAS_KIT.params));
  let mirror = $state(true);
  let arig = $state(atlasPose());                    // atlas rig pose, L/R keyed
  let choreo = $state(true);                         // procedural beats
  let ctiming = $state(structuredClone(CHOREO_TIMING));   // beat timing
  const RANDOM = "random";
  let cstyle = $state(RANDOM);
  let music = null;
  let musicOn = $state(false);
  let mus = $state({ bpm: MUSIC_DEFAULTS.bpm, gain: MUSIC_DEFAULTS.gain, energy: MUSIC_DEFAULTS.energy, swing: MUSIC_DEFAULTS.swing });
  let mstyle = $state(MUSIC_DEFAULTS.style);         // the genre the generator draws in
  let layers = $state({ ...MUSIC_DEFAULTS.layers });
  let mroot = $state(MUSIC_DEFAULTS.root);
  let mscale = $state(MUSIC_DEFAULTS.scale);
  const mkey = $derived(`${mroot} ${mscale}`);
  let move = $state({ beats: 2 });
  const beatsPerMove = $derived(move.beats);
  const period = $derived((beatsPerMove * 60) / mus.bpm);
  const MAX_STEPS = 4;                               // the longest style, in steps
  const grid = $derived.by(() => {
    let g = period / (beatsPerMove * 4);             // a 16th
    while (period / g < 2 * MAX_STEPS) g /= 2;
    return g;
  });
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
  const montageLabel = (name) => {
    const base = name.replace(/Opposed$/, "");
    return (PART_LABELS[base] ?? base) + (base === name ? "" : " opposed");
  };
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
    ["curl", "finger curl", 0, 1, 0.01],   // a 0..1 fist, not degrees
    ["hip", "leg swing", -45, 45, 1],
    ["knee", "knee bend", -60, 0, 1],
    ["ankle", "ankle bend", -30, 30, 1],
  ];
  const LEVEL_CTL = [["hipLevel", "hip level", -1.5, 0, 0.01]];
  const SIDED = new Set(SIDE_CHANNELS);
  const sided = (ctl, mir) =>
    ctl.flatMap(([key, label, ...rest]) =>
      !SIDED.has(key) ? [[key, label, ...rest]]
        : mir ? [[key + "L", label, ...rest]]
          : SIDES.map((S) => [key + S, `${label} ${S}`, ...rest]),
    );
  const coreCtl = [...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !SIDED.has(key));
  const flankCtl = (S) =>
    ATLAS_CTL.filter(([key]) => SIDED.has(key))
      .map(([key, label, ...rest]) => [key + S, label, ...rest]);
  const rigLocked = $derived(
    new Set(mirror ? SIDE_CHANNELS.map((key) => key + "R") : []),
  );
  const montages = $derived(atlasMontages(mirror));
  const mirrorWrites = (pose) => new Proxy(pose, {
    set(t, key, v) {
      t[key] = v;
      if (typeof key === "string" && key.endsWith("L") && SIDED.has(baseChan(key)))
        t[baseChan(key) + "R"] = v;
      return true;
    },
  });
  const poseIn = $derived(mirror ? mirrorWrites(arig) : arig);
  const twinOf = (key) =>
    (key.endsWith("L") && SIDED.has(baseChan(key)) ? baseChan(key) + "R" : null);
  const BIG_DEPTH = 2;
  const LEG_CHANNELS = ["hip", "knee", "ankle"];
  const CHOREO_SKIP = $derived(new Set(mirror ? LEG_CHANNELS : []));
  const CHOREO_PULSE = ["hipLevel"];
  const CHOREO_SPIN = "twist";
  const choreoSliders = $derived(
    sided([...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !CHOREO_SKIP.has(key)), mirror)
      .map(([key, , min, max]) => ({
        key, min, max,
        big: key === "hipLevel" || ATLAS_POSE_DEPTH[key] <= BIG_DEPTH,
      })),
  );
  const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];
  const CHOREO_GROUNDED = [SIDES.map((S) => LEG_CHANNELS.map((key) => key + S))];
  const CHOREO_PARK = $derived(
    mirror ? LEG_CHANNELS.flatMap((key) => SIDES.map((S) => key + S)) : [],
  );
  const CHOREO_CTL = [
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
    ["styleBeats", "style hold", 1, 30, 1],
    ["pulseChance", "hip pulse", 0, 1, 0.05],
  ];
  const MUSIC_CTL = [
    ["bpm", "tempo", 60, 200, 1],
    ["gain", "volume", 0, 1, 0.05],
    ["energy", "energy", 0, 1, 0.05],
    ["swing", "swing", 0, 0.6, 0.01],
  ];
  const MOVE_CTL = [["beats", "move every (beats)", 1, 4, 1]];
  const LAYERS = [
    ["kick", "kick"], ["snare", "snare"], ["hats", "hats"],
    ["bass", "bass"], ["lead", "lead"], ["chord", "chord"],
  ];

  function resetPart() { aparams[asel] = structuredClone(ATLAS_KIT.params[asel]); }
  function resetAtlas() { arig = atlasPose(); }
  function toggleMirror() { mirror = !mirror; rewires = (rewires + 1) | 0; }
  let rewires = $state(0);
  function resetChoreo() { ctiming = structuredClone(CHOREO_TIMING); }
  function shuffle() { seed = (seed + 1) | 0; }
  function playAssemble() { asm = 0; asmPlay = true; }
  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn) return music?.stop();
    music ??= createMusic({
      seed,
      style: mstyle,
      root: mroot,
      scale: mscale,
      ...$state.snapshot(mus),
      layers: $state.snapshot(layers),
    });
    music.start();
  }
  function pickStyle(name) {
    mstyle = name;
    const st = styleOf(name);
    mus.bpm = st.bpm;
    mus.swing = st.swing;
    mscale = st.scale;
  }

  const rigShown = $derived(asel === "rig");

  const model = $derived.by(() => {
    if (asel !== "rig") return ATLAS_KIT.partModel(asel, seed, $state.snapshot(aparams)[asel]);
    const m = atlasModel(seed, $state.snapshot(arig));
    if (asm >= 1) return m;
    // static body: no ride curve, the live items are their own anchors
    return { ...m, items: assembleModel(m.items, asm) };
  });
  $effect(() => { scene?.apply({ spin: render.spin }); });
  $effect(() => { scene?.apply({ lightAngle: render.light }); });
  $effect(() => { scene?.apply({ model }); });
  const PART_DIST = {
    digit: 2.5, palm: 3, forearm: 3.5, upperArm: 3.5,
    head: 3.5, foot: 3.5, shin: 4, thigh: 4, pelvis: 4, torso: 5.5,
  };
  $effect(() => {
    const dist = rigShown ? 12 : PART_DIST[asel] ?? 6;
    scene?.apply({ resetView: true, dist, lookY: rigShown ? atlasHeight(seed) / 2 : 0 });
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
  const live = $derived(createChoreographer(choreoSliders, {
    home: atlasPose(), montages, exclusives: CHOREO_EXCLUSIVE,
    grounded: CHOREO_GROUNDED, parked: CHOREO_PARK, pulse: CHOREO_PULSE,
    spin: CHOREO_SPIN,
    seed: (seed + rewires) | 0,
    style: cstyle === RANDOM ? null : cstyle,
    twin: mirror ? twinOf : null,
    onSwitch: toggleMirror,
    ...$state.snapshot(ctiming),
    period,
    grid,
  }));
  $effect(() => {
    const knobs = {
      style: mstyle, root: mroot, scale: mscale,
      ...$state.snapshot(mus), layers: $state.snapshot(layers),
    };
    music?.set(knobs);
  });
  $effect(() => () => music?.stop());   // leave the page, stop the noise

  $effect(() => {
    if (!choreo || !rigShown || asmPlay) return;
    const cho = live, pose = arig;
    let last = null;
    return driveRaf((dt) => {
      const q = musicOn ? music?.quarter() : null;
      if (q != null) {
        const at = Math.floor(q / beatsPerMove);
        if (last != null && at !== last && cho.span <= period * 1.01) cho.cue();
        last = at;
      }
      cho.step(dt, pose);
    });
  });
  const danceOnce = () => {
    if (choreo) return;                     // the beat is already running
    const cho = live, pose = arig;
    let t = 0;
    driveRaf((dt) => {
      cho.step(dt, pose);
      t += dt;
      if (t >= cho.span) return false;
    });
  };
  function beatOnce() {
    live.cue();                             // whatever was playing ends here
    danceOnce();
  }
  function playMontage(name) {
    live.play(name);
    danceOnce();                            // a montage owns the clock for its whole run
  }
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
    <menu>
      <li>
        <button type="button" aria-pressed={partsOpen} title="parts" aria-label="parts"
          onclick={() => (partsOpen = !partsOpen)}>{@html Bot}</button>
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
    <menu class="sound">
      <li>
        <button type="button" aria-pressed={musicOn} onclick={toggleMusic}
          title={musicOn ? `music on${mkey ? ` — ${mkey}` : ""}` : "music off"}
          aria-label={musicOn ? "stop music" : "play music"}>{@html musicOn ? VolumeUp : VolumeOff}</button>
      </li>
    </menu>
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
      <legend>panel</legend>
      <div role="group">
        <label><input type="radio" name="atlas-tab" value="render" bind:group={tab} />render</label>
        <label><input type="radio" name="atlas-tab" value="choreo" bind:group={tab} />choreo</label>
        <label><input type="radio" name="atlas-tab" value="rig" bind:group={tab} />rig</label>
      </div>
    </fieldset>

    {#if tab === "render"}
      <fieldset>
        <legend>render</legend>
        <Sliders ctl={RENDER_CTL} values={render} />
        <menu><li><button type="button" onclick={shuffle}>new color</button></li></menu>
      </fieldset>
    {:else if tab === "choreo"}
      <fieldset>
        <legend>choreo<button type="button" onclick={resetChoreo}>reset</button></legend>
        <label><input type="checkbox" bind:checked={choreo} /><span>autoplay</span></label>
        <label>
          <span>style</span>
          <select bind:value={cstyle}>
            <option value={RANDOM}>random</option>
            {#each CHOREO_STYLES as s}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <Sliders ctl={CHOREO_CTL} values={ctiming} />
        <menu>
          <li><button type="button" disabled={choreo} onclick={beatOnce}
            title="run a single beat" aria-label="run a single beat">▶ beat</button></li>
          {#each Object.keys(montages) as name, i}
            <li><button type="button" onclick={() => playMontage(name)}
              title={montageLabel(name)} aria-label={montageLabel(name)}>
              {MONTAGE_ICON(i)}</button></li>
          {/each}
        </menu>
      </fieldset>

      <fieldset>
        <legend>music — {mkey}</legend>
        <label>
          <span>style</span>
          <select value={mstyle} onchange={(e) => pickStyle(e.currentTarget.value)}>
            {#each MUSIC_STYLE_NAMES as s}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <label>
          <span>root</span>
          <select bind:value={mroot}>
            {#each MUSIC_ROOT_NAMES as r}<option value={r}>{r}</option>{/each}
          </select>
        </label>
        <label>
          <span>scale</span>
          <select bind:value={mscale}>
            {#each MUSIC_SCALE_NAMES as s}<option value={s}>{s}</option>{/each}
          </select>
        </label>
        <Sliders ctl={MUSIC_CTL} values={mus} />
        <Sliders ctl={MOVE_CTL} values={move} />
        {#each LAYERS as [key, label]}
          <label><input type="checkbox" bind:checked={layers[key]} /><span>{label}</span></label>
        {/each}
      </fieldset>
    {:else if asel === "rig"}
      <fieldset>
        <legend>core<button type="button" onclick={resetAtlas}>reset</button></legend>
        <Sliders ctl={coreCtl} values={poseIn} />
      </fieldset>
      {#each SIDES as S}
        <fieldset>
          <legend>{S === "L" ? "left" : "right"}</legend>
          {#if S === "L"}
            <label>
              <input type="checkbox" checked={mirror} onchange={toggleMirror} />
              <span>mirror</span>
            </label>
          {/if}
          <Sliders ctl={flankCtl(S)} values={poseIn} locked={rigLocked} />
        </fieldset>
      {/each}
    {:else}
      <fieldset>
        <legend>params<button type="button" onclick={resetPart}>reset</button></legend>
        <Sliders ctl={PART_CTL[asel]} values={aparams[asel]} />
      </fieldset>
    {/if}
  </aside>

<style>
  section > menu {
    top: 0.5rem;
    left: 0.5rem;
    min-width: 1rem;
    height: 1rem;
  }
  section > menu.sound {
    top: 3rem;
    width: 1rem;
  }
  section > menu button {
    width: auto;
    padding: 0 0.5rem;
    border-radius: 0;
    border: 0;
  }
  /* the icons come in through {@html}, so the scoping attribute never lands on them */
  section > menu button :global(svg) {
    width: 20px;
    height: 20px;
    display: block;
  }
</style>
