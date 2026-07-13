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
  import { createMusic, MUSIC_DEFAULTS } from "$lib/audio/music.js";

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
  // THE MUSIC. Two engines that know NOTHING about each other — the choreographer has never
  // heard of a note, the generator has never heard of a rig — wired together HERE and ONLY
  // through a clock: the music publishes the quarter note it plays, this page cues the
  // choreographer every `beatsPerMove` of them.
  //
  // Built lazily on the first click (a browser will not let a page make noise unasked), so
  // it lives outside `$state`: nothing renders off the object itself.
  let music = null;
  let musicOn = $state(false);
  let mus = $state({ bpm: MUSIC_DEFAULTS.bpm, gain: MUSIC_DEFAULTS.gain, energy: MUSIC_DEFAULTS.energy, swing: MUSIC_DEFAULTS.swing });
  let layers = $state({ ...MUSIC_DEFAULTS.layers });
  let mkey = $state("");                             // the key it drew, for the panel
  let mseed = $state(0);                             // bumped to change key mid-dance

  // THE TEMPO IS ONE NUMBER, and it is the music's: the choreographer's period is not a
  // knob, it is read off the bpm, so the two can never be dragged out of agreement.
  let move = $state({ beats: 2 });
  const beatsPerMove = $derived(move.beats);
  const period = $derived((beatsPerMove * 60) / mus.bpm);
  // THE GRID a step may begin or end on: a 16th note, HALVED until a style has at least
  // two ticks per step. At one beat per move a 16th grid leaves a four-step style exactly
  // four ticks, forcing every step to the same length and flattening the attack out of it.
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
  // A DRAGGED slider echoes onto the other flank as it lands: the hand on the
  // slider is the thing moving, and the right channel simply reads out what the
  // left is being given.
  // The BEAT does not write through this. A beat that echoed its writes would
  // TELEPORT the right flank the instant the mirror was clamped on — the right arm
  // is still wherever the split left it, and the first left write would snap it
  // across. The beat mirrors at PLAN time instead (`twin`, below), driving the
  // right flank onto the left over the same window it moves the left through.
  const mirrorWrites = (pose) => new Proxy(pose, {
    set(t, key, v) {
      t[key] = v;
      if (typeof key === "string" && key.endsWith("L") && SIDED.has(baseChan(key)))
        t[baseChan(key) + "R"] = v;
      return true;
    },
  });
  // what the SLIDERS write through: bare while the flanks are apart, echoing while
  // they move as one
  const poseIn = $derived(mirror ? mirrorWrites(arig) : arig);
  // ...and what the BEAT mirrors with: the right channel each left one drags along
  const twinOf = (key) =>
    (key.endsWith("L") && SIDED.has(baseChan(key)) ? baseChan(key) + "R" : null);
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
  // The hip level moves the WHOLE figure, so it does not compete with an arm for
  // the one main beat: it PULSES, riding under the beat across the full period, and
  // the body sinks and rises while the limbs keep dancing. The legs need no fencing
  // — whatever crouch the beat drops the hip into, the rig's solver keeps both feet
  // on the floor.
  const CHOREO_PULSE = ["hipLevel"];
  // a style with no `move` step (the all-antic one) has nothing carrying it, so the
  // waist twist turns the whole figure about its own axis under the flicking limbs
  const CHOREO_SPIN = "twist";
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
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
    ["styleBeats", "style hold", 1, 30, 1],
    ["pulseChance", "hip pulse", 0, 1, 0.05],
  ];
  // the music's knobs — the TEMPO among them, because the tempo belongs to the music
  const MUSIC_CTL = [
    ["bpm", "tempo", 60, 200, 1],
    ["gain", "volume", 0, 1, 0.05],
    ["energy", "energy", 0, 1, 0.05],
    ["swing", "swing", 0, 0.6, 0.01],
  ];
  // how much music a dance move is worth: 1 = every kick, 4 = one move a bar. The
  // dance's period falls out of this and the tempo.
  const MOVE_CTL = [["beats", "move every (beats)", 1, 4, 1]];
  const LAYERS = [
    ["kick", "kick"], ["snare", "snare"], ["hats", "hats"],
    ["bass", "bass"], ["lead", "lead"], ["chord", "chord"],
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
  // A flip REBUILDS the choreographer (the slider set changes under it), and a fresh
  // one draws its randomness from the seed — so the first roll after a flip is the
  // very roll that flipped it. Left alone the rig ping-pongs: mirrored, that roll
  // splits it; split, the same roll pairs it straight back up, beat after beat. So a
  // rewire ADVANCES the beat's seed, and the rig that comes out gets its own draw.
  function toggleMirror() { mirror = !mirror; rewires = (rewires + 1) | 0; }
  let rewires = $state(0);
  function resetChoreo() { ctiming = structuredClone(CHOREO_TIMING); }
  function shuffle() { seed = (seed + 1) | 0; }
  function playAssemble() { asm = 0; asmPlay = true; }
  // The music is switched on BY HAND, and has to be: an AudioContext built outside a user
  // gesture starts suspended. So this runs on the click, not in an effect downstream of it.
  function toggleMusic() {
    musicOn = !musicOn;
    if (!musicOn) return music?.stop();
    music ??= createMusic({
      seed: (seed + mseed) | 0,
      ...$state.snapshot(mus),
      layers: $state.snapshot(layers),
    });
    music.start();
    mkey = music.key;
  }
  // a KEY CHANGE mid-dance: scale, root and chord loop redrawn, patterns re-voiced at the
  // next bar, and the rig never breaks stride
  function newKey() {
    mseed = (mseed + 1) | 0;
    music?.reseed((seed + mseed) | 0);
    if (music) mkey = music.key;
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
    grounded: CHOREO_GROUNDED, parked: CHOREO_PARK, pulse: CHOREO_PULSE,
    spin: CHOREO_SPIN,
    seed: (seed + rewires) | 0,
    style: cstyle === RANDOM ? null : cstyle,
    // mirrored, the beat names the left flank and the right is DRIVEN after it —
    // never handed the value, which would snap it across
    twin: mirror ? twinOf : null,
    // a beat may take the flanks apart (or put them back together) on its own; the
    // slider set changes under it, so this rebuilds
    onSwitch: toggleMirror,
    ...$state.snapshot(ctiming),
    // the tempo, and the tick a step may land on, both read off the music's bpm
    period,
    grid,
  }));
  // The music's knobs are live: tempo and volume land at once, energy at the next section.
  // READING THE KNOBS BEFORE THE CALL IS LOAD-BEARING: written as
  // `music?.set({ ...$state.snapshot(mus) })` the optional chain short-circuits its own
  // ARGUMENTS while `music` is still null, so the effect registers no dependencies on the
  // first run and never fires again once the first click has built the thing.
  $effect(() => {
    const knobs = { ...$state.snapshot(mus), layers: $state.snapshot(layers) };
    music?.set(knobs);
  });
  $effect(() => () => music?.stop());   // leave the page, stop the noise

  // autoplay: rewrite the atlas pose in place every frame, so the rig sliders visibly ride
  // the beat. The beat writes the pose RAW — it mirrors through `twin` at plan time, so it
  // must not also echo through the sliders' proxy.
  //
  // THE MUSIC IS THE CLOCK. The dance runs off rAF and the music off the audio hardware, and
  // two clocks agreeing on the tempo still slide apart (a dropped frame, a throttled tab, a
  // slider edit rebuilding the choreographer mid-beat). So the dance is CUED off the count
  // the music publishes: in lock that costs nothing, out of lock it hauls the rig back on
  // the beat inside one move. A montage is left alone — it already ends on a downbeat.
  $effect(() => {
    if (!choreo || !rigShown) return;
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
  // ...and with autoplay off, a hand-fired beat drives the clock itself, for
  // exactly as long as that one beat lasts
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

      <fieldset>
        <legend>music</legend>
        <label>
          <input type="checkbox" checked={musicOn} onchange={toggleMusic} />
          <span>play{musicOn && mkey ? ` — ${mkey}` : ""}</span>
        </label>
        <Sliders ctl={MUSIC_CTL} values={mus} />
        <Sliders ctl={MOVE_CTL} values={move} />
        <menu>
          <li><button type="button" onclick={newKey} disabled={!musicOn}
            title="new key" aria-label="new key">🎵</button></li>
        </menu>
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
