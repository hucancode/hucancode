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

  let scene = $state(null);

  const ATLAS_PARTS = ATLAS_KIT.names;

  let tab = $state("rig");                 // which panel the aside is showing
  let asel = $state("rig");                // "rig" = the whole atlas, else a part
  let partsOpen = $state(false);           // the stage's part picker, shut by default
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
  // the style the beat is danced in — RANDOM lets the choreographer draw its own
  // and swap it every `style hold` beats, anything else pins it there
  const RANDOM = "random";
  let cstyle = $state(RANDOM);
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
    ["curl", "finger curl", -10, 40, 1],
    ["hip", "leg swing", -45, 45, 1],
    ["knee", "knee bend", -60, 0, 1],
    ["ankle", "ankle bend", -30, 30, 1],
  ];
  // The hip level sinks the figure on its legs: 0 stands it up, and each -1 sinks it
  // by another knee's worth of fold — so this goes deeper than one. It is a pose
  // channel like any other: the beat drives it, and the rig's leg solver answers for
  // it, folding the planted leg into the crouch and keeping the dancing one out of
  // the floor.
  const LEVEL_CTL = [["hipLevel", "hip level", -1.5, 0, 0.01]];
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
  // The rig panel in three: what the figure has ONE of (the spine, and the hip
  // level that sinks the whole of it), and then a fieldset per FLANK. The flank
  // owns the side, so its rows keep their bare names — `elbow bend`, not `elbow
  // bend L` — and the two columns read as the same limb twice.
  const coreCtl = [...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !SIDED.has(key));
  const flankCtl = (S) =>
    ATLAS_CTL.filter(([key]) => SIDED.has(key))
      .map(([key, label, ...rest]) => [key + S, label, ...rest]);
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
  // everything below them (elbow, wrist, fingers) is small detail. Split, every
  // limb channel enters twice, so a beat can pick the left elbow and leave the
  // right one alone.
  // The legs dance only while the flanks are APART: mirrored, every leg write is
  // copied onto the other flank, so the figure would lift both feet at once. So
  // mirroring, they sit the beat out and are PARKED instead — the first mirrored
  // beat walks them home and they stay planted; split, the grounded rule below
  // keeps one of the two on the floor.
  const BIG_DEPTH = 2;
  // a leg, in channels — the ankle rides with the hip and the knee, so taking a
  // foot off the floor is ONE rule over all three, not three rules
  const LEG_CHANNELS = ["hip", "knee", "ankle"];
  const CHOREO_SKIP = $derived(new Set(mirror ? LEG_CHANNELS : []));
  // The hip level is the biggest move the figure has — it sinks the whole body —
  // so it plays as a main beat. The legs need no fencing: whatever crouch the beat
  // drops the hip into, the rig's solver keeps both feet on the floor.
  const choreoSliders = $derived(
    sided([...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !CHOREO_SKIP.has(key)), mirror)
      .map(([key, , min, max]) => ({
        key, min, max,
        big: key === "hipLevel" || ATLAS_POSE_DEPTH[key] <= BIG_DEPTH,
      })),
  );
  // the waist ball's three channels share one joint: let each swing freely and
  // the torso folds through the pelvis, so only ever activate one of them
  const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];
  // the two legs, whole: the beat may take ONE of them off its rest pose — swing
  // the hip, bend the knee, pitch the ankle, all three — but never the other leg
  // at the same time, so the figure always has a leg under it. A leg only leaves
  // the floor once the other has come all the way home.
  const CHOREO_GROUNDED = [SIDES.map((S) => LEG_CHANNELS.map((key) => key + S))];
  // mirrored, both legs are parked: the beat never picks them, and the next beat
  // after the switch walks whatever the split flanks left lifted back down. The
  // mirror never touches the pose itself, so this is what squares the legs up.
  const CHOREO_PARK = $derived(
    mirror ? LEG_CHANNELS.flatMap((key) => SIDES.map((S) => key + S)) : [],
  );
  // beat timing knobs — the anticipation and rest slices bracket the main move,
  // so neither may eat the whole period
  const CHOREO_CTL = [
    ["period", "beat", 0.3, 3, 0.1],
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
    ["styleBeats", "style hold", 1, 30, 1],
    ["switchChance", "side switch", 0, 0.5, 0.01],
  ];

  function resetPart() { aparams[asel] = structuredClone(ATLAS_KIT.params[asel]); }
  function resetAtlas() { arig = atlasPose(); }
  // The mirror is a rule about the NEXT pose, never a rewrite of the current one:
  // flipping it copies nothing and moves nothing, it only changes who writes the
  // right channels from here on. So the figure holds whatever pose it is standing
  // in, and the next beat is the one that comes out mirrored — the flanks converge
  // by being DRIVEN together, not by being snapped.
  // The legs are how the beat squares itself up: mirrored, they are PARKED (see
  // CHOREO_PARK), so the first mirrored beat walks whatever the split flanks left
  // lifted back onto the floor.
  function toggleMirror() { mirror = !mirror; }
  function resetChoreo() { ctiming = structuredClone(CHOREO_TIMING); }
  function shuffle() { seed = (seed + 1) | 0; }
  function playAssemble() { asm = 0; asmPlay = true; }

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
  // fixed per-view distance (no auto-fit): single-part previews use a per-part
  // catalog distance — the atlas kit has much smaller pieces than the dragon's
  const PART_DIST = {
    digit: 2.5, palm: 3, forearm: 3.5, upperArm: 3.5,
    head: 3.5, foot: 3.5, shin: 4, thigh: 4, pelvis: 4, torso: 5.5,
  };
  // the atlas stands ON the grid, so the whole rig sits above y=0: the camera
  // has to look at its waist, not at the origin. Parts sit on their own origin.
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
  // THE CHOREOGRAPHER stands ready whether or not it is dancing: autoplay only
  // decides who turns the clock. So a montage or a single beat can be fired by
  // hand with the rig otherwise still. A timing (or style, or slider) edit builds a
  // fresh one — the tracks it had planned are cut to the old shape, so there is
  // nothing worth carrying over.
  const live = $derived(createChoreographer(choreoSliders, {
    home: atlasPose(), montages, exclusives: CHOREO_EXCLUSIVE,
    grounded: CHOREO_GROUNDED, parked: CHOREO_PARK, seed,
    style: cstyle === RANDOM ? null : cstyle,
    // a beat may take the flanks apart (or put them back together) on its own; the
    // slider set changes under it, so this rebuilds
    onSwitch: toggleMirror,
    ...$state.snapshot(ctiming),
  }));
  // autoplay: rewrite the atlas pose in place every frame, so the rig sliders
  // visibly ride the beat. The beat writes through the same mirror rule the sliders
  // do — mirrored, it only ever names left channels and the right flank follows.
  $effect(() => {
    if (!choreo || !rigShown) return;
    const cho = live, pose = poseIn;
    return driveRaf((dt) => cho.step(dt, pose));
  });
  // ...and with autoplay off, a hand-fired beat drives the clock itself, for
  // exactly as long as that one beat lasts
  const danceOnce = () => {
    if (choreo) return;                     // the beat is already running
    const cho = live, pose = poseIn;
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
    {:else if asel === "rig"}
      <fieldset>
        <legend>core<button type="button" onclick={resetAtlas}>reset</button></legend>
        <Sliders ctl={coreCtl} values={poseIn} />
      </fieldset>
      {#each SIDES as S}
        <fieldset>
          <legend>{S === "L" ? "left" : "right"}</legend>
          <!-- the mirror rides with the LEFT flank: it is the one that does the
               steering, and the right merely copies whatever it is handed -->
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
  }
  section > menu button {
    width: auto;
    min-width: 32px;
    padding: 0 0.5rem;
    border-radius: 0;
    border: 0;
  }
</style>
