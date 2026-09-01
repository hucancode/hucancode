<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import * as rt from "$lib/playgrounds/raytrace";
  import { ATLAS_KIT } from "$lib/mech/atlas/parts.js";
  import { atlasModel, atlasHeight, atlasPose, SIDES, ATLAS_DEF, chan, forSides, SIDED, SIDE_CHANNELS, CURL_SEG } from "$lib/mech/atlas/rig.js";
  // ---- atlas UI surface (inlined from $lib/ui/atlas.js) ----
// ATLAS UI SURFACE — the slider rows, mirror helpers, montages and choreographer
// config the atlas playground renders and drives. Everything here is presentation
// and control; the rig itself (links, solve, model) lives in lib/mech/atlas/rig.js,
// which supplies the shared sided-channel naming and rig data.
const DEG = Math.PI / 180;   // radian value of one degree, for writing constants

// the bare channel a flanked one came off (`elbowR` -> `elbow`); spine keys pass
const baseChan = (key) => {
  const b = key.slice(0, -1);
  return SIDES.includes(key.slice(-1)) && SIDED.has(b) ? b : key;
};

// ratio channels (a rate, a 0..1 fist) have no angle grid to snap to — also
// what the UI uses to decide a channel passes through without degree conversion
const ATLAS_RATIO = new Set(["curl", "hipLevel"]);

// ---- THE SLIDER SURFACE ------------------------------------------------------
// Every pose channel, its range, and the MIRROR rule laid over them. The rig is
// always split (see SIDE_CHANNELS), so mirroring is these functions tying the
// two flanks together — a caller's rule, never a wiring.
// [key, label, min, max, step?], on BARE channel names
const ATLAS_CTL = [
  ["headYaw", "head yaw", -Math.PI, Math.PI, DEG],
  ["headPitch", "head pitch", -30 * DEG, 30 * DEG, DEG],
  ["twist", "waist twist", -Math.PI, Math.PI, DEG],
  ["waistBend", "waist bend", -45 * DEG, 45 * DEG, DEG],
  ["waistTilt", "waist tilt", -45 * DEG, 45 * DEG, DEG],
  ["shoulder", "arm swing", -Math.PI, Math.PI, DEG],
  ["armOut", "arm raise", -10 * DEG, Math.PI, DEG],
  ["armTwist", "arm twist", -Math.PI, Math.PI, DEG],
  ["elbow", "elbow bend", -Math.PI / 2, Math.PI / 2, DEG],
  ["foreTwist", "forearm twist", -Math.PI, Math.PI, DEG],
  ["wristBend", "wrist bend", -100 * DEG, 100 * DEG, DEG],
  ["wristTilt", "wrist tilt", -100 * DEG, 100 * DEG, DEG],
  ["wristTwist", "wrist twist", -Math.PI, Math.PI, DEG],
  ["curl", "finger curl", 0, 1, 0.01],   // a 0..1 fist, not an angle
  ["hip", "leg swing", -45 * DEG, 45 * DEG, DEG],
  ["knee", "knee bend", -Math.PI / 3, 0, DEG],
  ["ankle", "ankle bend", -30 * DEG, 30 * DEG, DEG],
];
const LEVEL_CTL = [["hipLevel", "hip level", -1.5, 0, 0.01]];

// bare rows -> flanked ones; mirrored, the left channel stands for both
const sided = (ctl, mirror) =>
  ctl.flatMap(([key, label, ...rest]) =>
    !SIDED.has(key) ? [[key, label, ...rest]]
      : mirror ? [[key + "L", label, ...rest]]
        : SIDES.map((S) => [key + S, `${label} ${S}`, ...rest]),
  );
const coreCtl = [...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !SIDED.has(key));
const flankCtl = (S) =>
  ATLAS_CTL.filter(([key]) => SIDED.has(key))
    .map(([key, label, ...rest]) => [key + S, label, ...rest]);
// mirrored, the right flank is not the user's to edit — it follows the left
const rigLocked = (mirror) =>
  new Set(mirror ? SIDE_CHANNELS.map((key) => key + "R") : []);
// a pose whose left-flank writes land on the right flank too
const mirrorWrites = (pose) => new Proxy(pose, {
  set(t, key, v) {
    t[key] = v;
    if (typeof key === "string" && key.endsWith("L") && SIDED.has(baseChan(key)))
      t[baseChan(key) + "R"] = v;
    return true;
  },
});
const twinOf = (key) =>
  (key.endsWith("L") && SIDED.has(baseChan(key)) ? baseChan(key) + "R" : null);

// ---- ROUTINES ---------------------------------------------------------------
// A setup pose the rig strikes, then a KEYFRAME timeline: each key is a partial
// pose and the `hold` (in beats) it takes to reach it. A routine is an ARM routine,
// so REST stands the legs squarely and the solver folds them into whatever stance
// the hip level asks for.
const REST = {
  armOut: 0, shoulder: 0, armTwist: 0, elbow: 0, foreTwist: 0, wristBend: 0, wristTilt: 0,
  wristTwist: 0, curl: 0, twist: 0, waistBend: 0, waistTilt: 0,
  headPitch: 0, headYaw: 0, hip: 0, knee: 0, ankle: 0,
};

const fist = (n) => Math.abs(n) / (Math.PI / 2);
const WAVE = (lead, level, n) => [
  { hold: 0.15, pose: { [lead]: level + n, elbow: -2 * n, wristBend: n } },
  { hold: 0.12, pose: { [lead]: level, elbow: n, wristBend: -2 * n } },
  { hold: 0.12, pose: { elbow: 0, wristBend: n } },
  { hold: 0.12, pose: { wristBend: 0, curl: fist(n) } },
  { hold: 0.15, pose: { curl: 0 } },
];

const VERT_WAVE = (lead, level, n) => [
  { hold: 0.12, pose: { curl: fist(n) } },
  { hold: 0.12, pose: { wristBend: n, curl: 0 } },
  { hold: 0.12, pose: { elbow: n, wristBend: -2 * n, curl: fist(n) } },
  { hold: 0.12, pose: { [lead]: level - n, elbow: -2 * n, wristBend: n, curl: 0 } },
  { hold: 0.12, pose: { [lead]: level, elbow: 0, wristBend: 0, curl: 0 } },
];

const P2 = Math.PI / 2;   // 90°
const STYLE = {
  sideOut: { raise: { armOut: P2, armTwist: -P2 }, keys: WAVE("armOut", P2, 35 * DEG), loops: 2 },
  front: { raise: { shoulder: P2 }, keys: WAVE("shoulder", P2, 35 * DEG), loops: 2 },
  back: { raise: { shoulder: -P2 }, keys: WAVE("shoulder", -P2, -35 * DEG), loops: 2 },
  overhead: { raise: { armOut: Math.PI, armTwist: 0 }, keys: VERT_WAVE("shoulder", 0, 20 * DEG), loops: 2 },
};

const ROUTINES = {
  armWave: { L: STYLE.sideOut, R: STYLE.sideOut },
  frontWave: { L: STYLE.front, R: STYLE.front },
  frontWaveOpposed: { L: STYLE.front, R: STYLE.back },
  verticalWave: { L: STYLE.overhead, R: STYLE.overhead },
};

const onSide = (pose, S) =>
  Object.fromEntries(Object.entries(pose).map(([k, v]) => [chan(k, S), v]));

const atlasMontages = (mirror = false) =>
  Object.fromEntries(
    Object.entries(ROUTINES)
      .filter(([name]) => !mirror || !name.endsWith("Opposed"))
      .map(([name, { L, R }]) => [name, {
        setup: { ...forSides(REST), ...onSide(L.raise, "L"), ...onSide(R.raise, "R") },
        keys: L.keys.map((k, i) => ({
          ...k,
          pose: { ...onSide(k.pose, "L"), ...onSide(R.keys[i].pose, "R") },
        })),
        loops: L.loops,
      }]),
  );

const MONTAGE_LABELS = { armWave: "arm wave", frontWave: "front wave", verticalWave: "vertical wave" };
const montageLabel = (name) => {
  const base = name.replace(/Opposed$/, "");
  return (MONTAGE_LABELS[base] ?? base) + (base === name ? "" : " opposed");
};

// bone depth of every pose channel (pelvis = 0). A channel drives the link it
// sits on, so its depth IS that link's depth: `twist` turns the torso near the
// root, `curl` turns a finger out at a leaf. The choreographer reads this to
// tell a big root move from a small leaf one.
const ATLAS_POSE_DEPTH = (() => {
  const depth = {}, out = {};
  const note = (key, d) => { out[key] = key in out ? Math.min(out[key], d) : d; };
  for (const d of ATLAS_DEF) {
    const dep = d.parent ? depth[d.parent] + 1 : 0;
    depth[d.name] = dep;
    for (const bind of d.angles ?? []) {
      if (!bind) continue;
      if (Array.isArray(bind[0])) for (const b of bind) { if (b) note(b[0], dep); }
      else note(bind[0], dep);
    }
  }
  // the digits ride the segment channels, so the `curl` SLIDER binds nothing of its
  // own — it is as deep as the knuckles it rolls
  for (const S of SIDES)
    out[chan("curl", S)] = Math.min(...CURL_SEG.map((key) => out[key + S]));
  return out;
})();

// ---- WHAT A CHOREOGRAPHER MAY DRIVE -----------------------------------------
const BIG_DEPTH = 2;                 // this near the root, a channel carries a beat
const LEG_CHANNELS = ["hip", "knee", "ankle"];
const CHOREO_PULSE = ["hipLevel"];   // whole-body: its own slot in the beat
const CHOREO_SPIN = "twist";
const CHOREO_EXCLUSIVE = [["twist", "waistBend", "waistTilt"]];   // one waist ball
const CHOREO_GROUNDED = [SIDES.map((S) => LEG_CHANNELS.map((key) => key + S))];
const RATIO = ATLAS_RATIO;
// mirrored, the legs move as ONE and the figure would hop: take them out of the beat
// and park them (a leg left in the air by the flip still has to walk home)
const choreoSliders = (mirror) => {
  const skip = new Set(mirror ? LEG_CHANNELS : []);
  return sided([...LEVEL_CTL, ...ATLAS_CTL].filter(([key]) => !skip.has(key)), mirror)
    .map(([key, , min, max]) => ({
      key, min, max,
      big: key === "hipLevel" || ATLAS_POSE_DEPTH[key] <= BIG_DEPTH,
      grid: RATIO.has(baseChan(key)) ? 0 : undefined,
    }));
};
// the whole rig, as createChoreographer wants it, under the mirror rule
const atlasChoreo = (mirror) => ({
  sliders: choreoSliders(mirror),
  home: atlasPose(),
  montages: atlasMontages(mirror),
  exclusives: CHOREO_EXCLUSIVE,
  grounded: CHOREO_GROUNDED,
  parked: mirror ? LEG_CHANNELS.flatMap((key) => SIDES.map((S) => key + S)) : [],
  pulse: CHOREO_PULSE,
  spin: CHOREO_SPIN,
  twin: mirror ? twinOf : null,
});

// ---- PART PICKER ------------------------------------------------------------
// Slider surface for the part picker, in model units (no unit conversion).
const PART_LABELS = { upperArm: "upper arm" };

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
  import { rad, deg } from "$lib/math/scalar.js";
  import { assembleModel, BUILD_SECONDS } from "$lib/mech/build-anim.js";
  import { createChoreographer, beatClock, CHOREO_TIMING, CHOREO_STYLES } from "$lib/mech/choreo.js";
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
  const clock = $derived(beatClock(mus.bpm, move.beats));
  // assembly build scrub: 1 = fully assembled, <1 runs the 4-phase build
  let asm = $state(1);
  let asmPlay = $state(false);
  let seed = $state(1);                    // color shuffle seed

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

  // pose channels arrive from the rig in RADIANS; sliders speak DEGREES. A few
  // channels are ratios (curl 0..1, hipLevel a rate) and pass through untouched.
  const isRatio = (key) => ATLAS_RATIO.has(baseChan(key));
  const uiCtl = (rows) => rows.map(([key, label, min, max, step]) =>
    isRatio(key) ? [key, label, min, max, step]
      : [key, label, deg(min), deg(max), step ? deg(step) : 0.01]);
  const uiVal = (key, v) => (isRatio(key) ? v : deg(v));
  const setPoseVal = (key, v) => (isRatio(key) ? +v : rad(+v));

  // raytracer material slots — symmetric atlas parts fold onto one picker entry
  const MATERIAL_TYPES = ["lambertian", "metal", "dielectric"];
  const RT_PARTS = [
    ["pelvis", "pelvis"], ["torso", "torso"], ["head", "head"],
    ["upperArm", "upper arm"], ["forearm", "forearm"], ["hand", "hand"],
    ["thigh", "thigh"], ["shin", "shin"], ["foot", "foot"],
  ];
  const DEFAULT_MATERIALS = {
    pelvis: { type: "metal", fuzz: 0.08 },
    torso: { type: "lambertian", roughness: 0.3 },
    head: { type: "dielectric", ior: 1.5 },
    upperArm: { type: "metal", fuzz: 0.1 },
    forearm: { type: "lambertian", roughness: 0.3 },
    hand: { type: "metal", fuzz: 0.15 },
    thigh: { type: "lambertian", roughness: 0.3 },
    shin: { type: "metal", fuzz: 0.1 },
    foot: { type: "metal", fuzz: 0.05 },
  };
  let materials = $state(structuredClone(DEFAULT_MATERIALS));
  const PART_OF_GROUP = (group) => {
    const link = group ? group.slice(0, group.indexOf(":")) : "";
    if (link.startsWith("dig") || link.startsWith("palm")) return "hand";
    let base = link;
    if (base.endsWith("L") || base.endsWith("R")) base = base.slice(0, -1);
    switch (base) {
      case "arm": return "upperArm";
      case "fore": return "forearm";
      case "leg": return "thigh";
      case "shin": return "shin";
      case "foot": return "foot";
      default: return base;
    }
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
  const MUSIC_CTL = [
    ["bpm", "tempo", 60, 200, 1],
    ["gain", "volume", 0, 1, 0.05],
    ["energy", "energy", 0, 1, 0.05],
    ["swing", "swing", 0, 0.6, 0.01],
  ];
  const MOVE_CTL = [["beats", "move every (beats)", 1, 4, 1]];
  // the slider surface over CHOREO_TIMING (seconds / ratios, no unit conversion)
  const CHOREO_CTL = [
    ["anticRatio", "anticipation", 0, 0.4, 0.01],
    ["restRatio", "rest", 0, 0.4, 0.01],
    ["bounceTime", "bounce time", 0.05, 0.6, 0.01],
    ["bouncePower", "bounce power", 0, 1, 0.01],
    ["styleBeats", "style hold", 1, 30, 1],
    ["pulseChance", "hip pulse", 0, 1, 0.05],
  ];
  const LAYERS = [
    ["kick", "kick"], ["snare", "snare"], ["hats", "hats"],
    ["bass", "bass"], ["lead", "lead"], ["chord", "chord"],
  ];

  const rig = $derived(atlasChoreo(mirror));
  const poseIn = $derived(mirror ? mirrorWrites(arig) : arig);

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
  const PART_DIST = {
    digit: 2.5, palm: 3, forearm: 3.5, upperArm: 3.5,
    head: 3.5, foot: 3.5, shin: 4, thigh: 4, pelvis: 4, torso: 5.5,
  };
  $effect(() => {
    const dist = rigShown ? 12 : PART_DIST[asel] ?? 6;
    engine;   // reframe the swapped-in renderer on the same view
    scene?.apply({ resetView: true, dist, lookY: rigShown ? atlasHeight(seed) / 2 : 0 });
  });
  $effect(() => {
    if (!render.raytrace) return;
    const t = setInterval(() => {
      stats = rt.getStats();
      stats.instances = model.items.length;
    }, 400);
    return () => clearInterval(t);
  });
  $effect(() => {
    const knobs = {
      style: mstyle, root: mroot, scale: mscale,
      ...$state.snapshot(mus), layers: $state.snapshot(layers),
    };
    music?.set(knobs);
  });
  $effect(() => () => music?.stop());   // leave the page, stop the noise

  // the beat, and the quarter note it last synced to — a fresh choreographer starts
  // its count over
  const beat = $derived({ cho: createChoreographer(rig.sliders, {
    ...rig,
    seed: (seed + rewires) | 0,
    style: cstyle === RANDOM ? null : cstyle,
    onSwitch: toggleMirror,
    ...$state.snapshot(ctiming),
    ...clock,
  }), last: null });
  let solo = null;   // a hand-fired beat/montage, running while autoplay is off

  // every page clock runs off the canvas's frame, so they pause with it
  function frame(dt) {
    if (rigShown && asmPlay) {
      asm = Math.min(1, asm + dt / BUILD_SECONDS);
      if (asm >= 1) asmPlay = false;
    } else if (rigShown && choreo) {
      const q = musicOn ? music?.quarter() : null;
      if (q != null) {
        const at = Math.floor(q / move.beats);
        if (beat.last != null && at !== beat.last && beat.cho.span <= clock.period * 1.01) beat.cho.cue();
        beat.last = at;
      }
      beat.cho.step(dt, arig);
    } else {
      beat.last = null;
    }
    if (solo) {
      solo.cho.step(dt, solo.pose);
      solo.t += dt;
      if (solo.t >= solo.cho.span) solo = null;
    }
  }
  const danceOnce = () => {
    if (choreo) return;                     // the beat is already running
    solo = { cho: beat.cho, pose: arig, t: 0 };
  };
  function beatOnce() {
    beat.cho.cue();                         // whatever was playing ends here
    danceOnce();
  }
  function playMontage(name) {
    beat.cho.play(name);
    danceOnce();                            // a montage owns the clock for its whole run
  }
</script>

<svelte:head><title>Atlas</title></svelte:head>

  <section>
    <Scene bind:this={scene} scene={engine} id="atlas" onFrame={frame}
      onError={() => (render.raytrace = false)} />
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
      <legend>panel</legend>
      <menu role="group">
        <li><label><input type="radio" name="atlas-tab" value="render" bind:group={tab} />render</label></li>
        <li><label><input type="radio" name="atlas-tab" value="choreo" bind:group={tab} />choreo</label></li>
        <li><label><input type="radio" name="atlas-tab" value="rig" bind:group={tab} />rig</label></li>
      </menu>
    </fieldset>

    {#if tab === "render"}
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
        {#if rigShown}
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
        {#each CHOREO_CTL as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!ctiming[key]}
              onchange={(e) => (ctiming[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={ctiming[key]}
                oninput={(e) => (ctiming[key] = +e.currentTarget.value)} />
              <output>{ctiming[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
        <menu>
          <li><button type="button" disabled={choreo} onclick={beatOnce}
            title="run a single beat" aria-label="run a single beat">▶ beat</button></li>
          {#each Object.keys(rig.montages) as name, i}
            <li><button type="button" onclick={() => playMontage(name)}
              title={montageLabel(name)} aria-label={montageLabel(name)}>
              {`🌊${i+1}`}</button></li>
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
        {#each MUSIC_CTL as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!mus[key]}
              onchange={(e) => (mus[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={mus[key]}
                oninput={(e) => (mus[key] = +e.currentTarget.value)} />
              <output>{mus[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
        {#each MOVE_CTL as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!move[key]}
              onchange={(e) => (move[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={move[key]}
                oninput={(e) => (move[key] = +e.currentTarget.value)} />
              <output>{move[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
        {#each LAYERS as [key, label]}
          <label><input type="checkbox" bind:checked={layers[key]} /><span>{label}</span></label>
        {/each}
      </fieldset>
    {:else if asel === "rig"}
      <fieldset>
        <legend>core<button type="button" onclick={resetAtlas}>reset</button></legend>
        {#each uiCtl(coreCtl) as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!poseIn[key]}
              onchange={(e) => (poseIn[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={uiVal(key, poseIn[key])}
                oninput={(e) => (poseIn[key] = setPoseVal(key, e.currentTarget.value))} />
              <output>{uiVal(key, poseIn[key]).toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
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
          {#each uiCtl(flankCtl(S)) as [key, label, min, max, step]}
            {#if min === 0 && max === 1 && step === 1}
              <label><input type="checkbox" checked={!!poseIn[key]} disabled={rigLocked(mirror)?.has(key)}
                onchange={(e) => (poseIn[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
            {:else}
              <label><span>{label}</span>
                <input type="range" {min} {max} step={step ?? 0.01} value={uiVal(key, poseIn[key])} disabled={rigLocked(mirror)?.has(key)}
                  oninput={(e) => (poseIn[key] = setPoseVal(key, e.currentTarget.value))} />
                <output>{uiVal(key, poseIn[key]).toFixed(step && step >= 1 ? 0 : 2)}</output></label>
            {/if}
          {/each}
        </fieldset>
      {/each}
    {:else}
      <fieldset>
        <legend>params<button type="button" onclick={resetPart}>reset</button></legend>
        {#each PART_CTL[asel] as [key, label, min, max, step]}
          {#if min === 0 && max === 1 && step === 1}
            <label><input type="checkbox" checked={!!aparams[asel][key]}
              onchange={(e) => (aparams[asel][key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
          {:else}
            <label><span>{label}</span>
              <input type="range" {min} {max} step={step ?? 0.01} value={aparams[asel][key]}
                oninput={(e) => (aparams[asel][key] = +e.currentTarget.value)} />
              <output>{aparams[asel][key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
          {/if}
        {/each}
      </fieldset>
    {/if}
  </aside>

<style>
  /* the two stage menus stack in the top-left corner (playground.css floats them) */
  section > menu { top: 0.5rem; left: 0.5rem; }
  section > menu.sound { top: 3rem; }
  /* part names ride in the same pill menu as the icons: as wide as their label */
  section > menu button { width: auto; padding: 0 0.5rem; }
  /* the icons come in through {@html}, so the scoping attribute never lands on them */
  section > menu button :global(svg) {
    width: 20px;
    height: 20px;
    display: block;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.75rem;
    margin: 0;
    font-size: 0.85rem;
  }
  dt { opacity: 0.6; }
  dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }

  ul.mats { display: grid; gap: 0.4rem; }
  li.mat-row { display: flex; align-items: center; gap: 0.4rem; }
  .mat-name { flex: 1; font-size: 0.8rem; opacity: 0.85; }
  li.mat-row select { flex: none; max-width: 6.5rem; font-size: 0.8rem; }
  li.mat-row input[type="range"] { flex: 1; max-width: 5.5rem; }
</style>
