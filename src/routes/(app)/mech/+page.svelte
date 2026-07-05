<script>
  import Scene from "$lib/components/mech.svelte";
  import Return from "$icons/line-md/chevron-left.svg?raw";
  import {
    partModel, primitiveModel,
    PART_NAMES, PRIM_NAMES, PRIM_PARAMS, PART_PARAMS, JOINT_POSE,
  } from "$lib/playgrounds/mech/parts.js";
  import { dragonModel, DRAGON_POSE } from "$lib/playgrounds/mech/rig.js";

  let scene = $state(null);

  // joints live in the parts tab (a joint is a catalog part in its own right)
  const JOINTS = ["hinge1", "hinge2", "hinge3", "pivot1", "ball1"];
  const PARTS = PART_NAMES.filter((n) => !JOINTS.includes(n));

  let view = $state("parts");             // "parts" | "primitives" | "dragon"
  let selPart = $state(PARTS[0]);         // a part OR a joint name
  let selPrim = $state(PRIM_NAMES[0]);
  const isJoint = (n) => JOINTS.includes(n);
  let pparams = $state(structuredClone(PRIM_PARAMS));
  let jparams = $state(structuredClone(PART_PARAMS));
  let jpose = $state(structuredClone(JOINT_POSE));   // runtime joint rotations, degrees
  let drig = $state(structuredClone(DRAGON_POSE));   // dragon rig pose
  let autoplay = $state(false);                      // fly the loop automatically
  const LAP_SECONDS = 4;
  let seed = $state(1);                    // color shuffle seed

  // HUD
  let spin = $state(0.3);
  let light = $state(0.6);

  const PART_LABELS = {
    head: "dragon head",
    bodySegment: "body segment",
    bodySegment2: "body segment 2",
    arm: "dragon arm",
    leg: "dragon leg",
    tail: "dragon tail",
    hinge1: "hinge 1",
    hinge2: "hinge 2",
    hinge3: "hinge 3",
    pivot1: "pivot 1 · double pivot",
    ball1: "ball 1 · ball + socket",
  };
  const PRIM_LABELS = {
    cylinder: "cylinder", cone: "cone", coneCut: "cut cone",
    box: "box", sphere: "sphere", hemisphere: "hemisphere",
    cutHemisphere: "cut hemisphere",
    halfCylinder: "half cylinder", halfCylinderBox: "arch box",
    boxCylinder: "stamper", quarterCylinder: "quarter disc",
  };
  // [key, label, min, max] sliders per joint part
  const PART_CTL = {
    head: [["headW", "head width", 0.7, 2.0], ["snoutLen", "snout length", 0.5, 2.0], ["jawOpen", "jaw open deg", 0, 45], ["eyeR", "eye radius", 0.08, 0.3], ["hornLen", "horn length", 0.1, 1.2]],
    bodySegment: [["bodyR", "body radius", 0.3, 0.9], ["segLen", "segment length", 0.8, 3.0], ["discs", "belly discs", 2, 7, 1], ["finR", "fin radius", 0.15, 0.8]],
    bodySegment2: [["rFront", "front radius", 0.25, 0.9], ["rRear", "rear radius", 0.15, 0.8], ["segLen", "segment length", 0.8, 3.0], ["finR", "fin radius", 0.15, 0.8]],
    arm: [["upperLen", "upper arm", 0.25, 1.2], ["foreLen", "forearm", 0.2, 1.2], ["elbowBend", "elbow bend deg", 0, 70], ["clawR", "claw radius", 0.15, 0.5]],
    leg: [["thighLen", "thigh", 0.25, 1.2], ["shinLen", "shin", 0.2, 1.2], ["kneeBend", "knee bend deg", 0, 60], ["footLen", "foot length", 0.15, 0.9], ["clawR", "claw radius", 0.15, 0.5]],
    tail: [["coreLen", "core length", 0.6, 2.5], ["bodyR", "body radius", 0.2, 0.7], ["tipLen", "tip length", 0.4, 2.2]],
    hinge2: [["gap", "arm gap", 0.1, 0.6], ["armT", "arm thickness", 0.05, 0.3], ["armH", "arm length", 0.3, 1.2], ["depth", "depth", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24]],
    hinge3: [["tongueT", "tongue thickness", 0.1, 0.5], ["armT", "arm thickness", 0.06, 0.3], ["armLen", "arm length", 0.2, 1.0], ["barrelR", "barrel radius", 0.15, 0.6], ["barrelLen", "barrel length", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24]],
    pivot1: [["barrelR", "barrel radius", 0.12, 0.6], ["barrelLen", "barrel length", 0.3, 1.8], ["flangeR", "flange radius", 0.2, 0.9], ["neckR", "neck radius", 0.08, 0.4], ["neckLen", "neck length", 0.05, 0.5], ["capR", "cap radius", 0.12, 0.6]],
    hinge1: [["gap", "arm gap", 0.1, 0.6], ["armT", "arm thickness", 0.05, 0.3], ["armH", "arm length", 0.3, 1.2], ["depth", "depth", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24]],
    ball1: [["ballR", "ball radius", 0.15, 0.6], ["socketT", "socket wall", 0.05, 0.25], ["cut", "socket cut", 0.4, 0.9], ["shaftR", "shaft radius", 0.05, 0.25], ["shaftLen", "shaft length", 0.1, 0.9], ["baseW", "base width", 0.4, 1.6]],
  };
  // [key, label, min, max] runtime rotation sliders per joint (degrees)
  const POSE_CTL = {
    hinge1: [["swing", "swing deg", -90, 90], ["twistF", "twist female deg", -180, 180], ["twistM", "twist male deg", -180, 180]],
    hinge2: [["swing", "swing deg", -90, 90]],
    hinge3: [["swing", "swing deg", -90, 90], ["spinF", "spin mount 1 deg", -180, 180], ["spinM", "spin mount 2 deg", -180, 180]],
    pivot1: [["spinA", "spin top deg", -180, 180], ["spinB", "spin bottom deg", -180, 180]],
    ball1: [["rx", "rotate x deg", -50, 50], ["ry", "rotate y deg", -180, 180], ["rz", "rotate z deg", -50, 50]],
  };
  // dragon rig runtime controls — offset slides the body along the loop curve
  const DRAGON_CTL = [
    ["offset", "loop offset", 0, 1, 0.002],
    ["jaw", "jaw open deg", 0, 45, 1],
    ["armSwing", "arm swing deg", -60, 60, 1],
    ["elbow", "elbow bend deg", 0, 70, 1],
    ["legSwing", "leg swing deg", -60, 60, 1],
    ["knee", "knee bend deg", 0, 60, 1],
  ];
  // [key, label, min, max] sliders per primitive; `fit` gets its own toggle
  const PRIM_CTL = {
    cylinder: [["r", "radius", 0.1, 1.2], ["h", "height", 0.1, 2.5]],
    cone: [["r", "radius", 0.1, 1.2], ["h", "height", 0.1, 2.5]],
    coneCut: [["r0", "base radius", 0.1, 1.2], ["r1", "top radius", 0, 1.2], ["h", "height", 0.1, 2.5]],
    box: [["w", "width", 0.1, 2.5], ["h", "height", 0.1, 2.5], ["d", "depth", 0.1, 2.5], ["slope", "top slope %", 0, 1], ["curve", "slope curve", -1, 1]],
    sphere: [["r", "radius", 0.1, 1.4]],
    hemisphere: [["r", "radius", 0.1, 1.4]],
    cutHemisphere: [["r", "radius", 0.15, 1.2], ["t", "wall %", 0.05, 0.5], ["cut", "cut height %", 0.2, 0.9]],
    halfCylinder: [["r", "radius", 0.1, 1.2], ["h", "height", 0.1, 2.5]],
    halfCylinderBox: [["r", "radius", 0.1, 1.2], ["h", "height", 0.1, 2.5], ["depth", "box depth", 0.05, 1.5]],
    boxCylinder: [["w", "box width", 0.2, 2.2], ["d", "box depth", 0.2, 2.2], ["boxH", "box height", 0.1, 1.5], ["cylH", "cylinder h %", 0.1, 3]],
    quarterCylinder: [["r", "radius", 0.1, 1.2], ["h", "thickness", 0.05, 1.5]],
  };

  function resetParams() { pparams[selPrim] = structuredClone(PRIM_PARAMS[selPrim]); }
  function resetJointParams() {
    jparams[selPart] = structuredClone(PART_PARAMS[selPart]);
    if (isJoint(selPart)) jpose[selPart] = structuredClone(JOINT_POSE[selPart]);
  }
  function resetDragon() { drig = structuredClone(DRAGON_POSE); }
  function shuffle() { seed = (seed + 1) | 0; }

  const model = $derived.by(() => {
    if (view === "primitives") return primitiveModel(selPrim, $state.snapshot(pparams)[selPrim], seed);
    if (view === "dragon") return dragonModel(seed, $state.snapshot(drig));
    if (isJoint(selPart)) return partModel(selPart, seed, $state.snapshot(jparams)[selPart], $state.snapshot(jpose)[selPart]);
    return partModel(selPart, seed, $state.snapshot(jparams)[selPart]);
  });

  $effect(() => { scene?.apply({ spin }); });
  $effect(() => { scene?.apply({ lightAngle: light }); });
  $effect(() => { scene?.apply({ model }); });
  // fixed per-view distance (no auto-fit): the dragon rides a big loop
  $effect(() => { selPart; selPrim; scene?.apply({ resetView: true, dist: view === "dragon" ? 24 : 6 }); });
  // autoplay: advance the loop offset each frame while enabled
  $effect(() => {
    if (!autoplay || view !== "dragon") return;
    let raf, last = performance.now();
    const tick = (t) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      drig.offset = (drig.offset + dt / LAP_SECONDS) % 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

<svelte:head><title>Mech</title></svelte:head>

<nav><a class="back" href="/playgrounds">{@html Return} Playgrounds</a></nav>

<main>
  <section>
    <Scene bind:this={scene} />
    <div class="hud">
      <div class="row knobs">
        <label><span>Spin</span><input type="range" min="0" max="3" step="0.1" bind:value={spin} /></label>
        <label><span>Light</span><input type="range" min="0" max="6.28" step="0.05" bind:value={light} /></label>
        <button type="button" onclick={shuffle}>🎨 shuffle colors</button>
        <button type="button" onclick={() => scene?.apply({ resetView: true })}>Reset view</button>
      </div>
    </div>
  </section>

  <aside>
    <fieldset>
      <legend>view</legend>
      <div class="tabs">
        <button type="button" class:on={view === "parts"} onclick={() => (view = "parts")}>parts</button>
        <button type="button" class:on={view === "primitives"} onclick={() => (view = "primitives")}>blocks</button>
        <button type="button" class:on={view === "dragon"} onclick={() => (view = "dragon")}>dragon</button>
      </div>
    </fieldset>

    {#if view === "parts"}
      <fieldset>
        <legend>parts</legend>
        <ul class="jlist">
          {#each PARTS as pn}
            <li><button type="button" class:on={selPart === pn} onclick={() => (selPart = pn)}>{PART_LABELS[pn] ?? pn}</button></li>
          {/each}
        </ul>
        <div class="grp">joints — mechanism blocks</div>
        <ul class="jlist">
          {#each JOINTS as jn}
            <li><button type="button" class:on={selPart === jn} onclick={() => (selPart = jn)}>{PART_LABELS[jn] ?? jn}</button></li>
          {/each}
        </ul>
      </fieldset>
      <fieldset>
        <legend>{PART_LABELS[selPart] ?? selPart} params <button type="button" class="add" onclick={resetJointParams}>↺ reset</button></legend>
        {#each PART_CTL[selPart] as [key, label, min, max, step]}
          <label><span>{label}</span>
            <input type="range" {min} {max} step={step ?? 0.01} value={jparams[selPart][key]}
              oninput={(e) => (jparams[selPart][key] = +e.currentTarget.value)} />
            <output>{jparams[selPart][key].toFixed(step ? 0 : 2)}</output></label>
        {/each}
        {#if isJoint(selPart)}
          <div class="grp">runtime pose — joint rotations</div>
          {#each POSE_CTL[selPart] as [key, label, min, max]}
            <label><span>{label}</span>
              <input type="range" {min} {max} step="1" value={jpose[selPart][key]}
                oninput={(e) => (jpose[selPart][key] = +e.currentTarget.value)} />
              <output>{jpose[selPart][key].toFixed(0)}</output></label>
          {/each}
        {/if}
      </fieldset>
    {:else if view === "dragon"}
      <fieldset>
        <legend>dragon rig <button type="button" class="add" onclick={resetDragon}>↺ reset</button></legend>
        <label class="chk"><input type="checkbox" bind:checked={autoplay} /><span>autoplay</span></label>
        {#each DRAGON_CTL as [key, label, min, max, step]}
          <label><span>{label}</span>
            <input type="range" {min} {max} {step} value={drig[key]}
              oninput={(e) => (drig[key] = +e.currentTarget.value)} />
            <output>{drig[key].toFixed(step < 1 ? 2 : 0)}</output></label>
        {/each}
      </fieldset>
    {:else}
      <fieldset>
        <legend>primitives</legend>
        <ul class="jlist">
          {#each PRIM_NAMES as pn}
            <li><button type="button" class:on={selPrim === pn} onclick={() => (selPrim = pn)}>{PRIM_LABELS[pn] ?? pn}</button></li>
          {/each}
        </ul>
      </fieldset>
      <fieldset>
        <legend>{PRIM_LABELS[selPrim] ?? selPrim} params <button type="button" class="add" onclick={resetParams}>↺ reset</button></legend>
        {#each PRIM_CTL[selPrim] as [key, label, min, max]}
          <label><span>{label}</span>
            <input type="range" {min} {max} step="0.01" value={pparams[selPrim][key]}
              oninput={(e) => (pparams[selPrim][key] = +e.currentTarget.value)} />
            <output>{pparams[selPrim][key].toFixed(2)}</output></label>
        {/each}
        {#if selPrim === "boxCylinder"}
          <div class="grp">cylinder fit</div>
          <div class="tabs">
            <button type="button" class:on={pparams.boxCylinder.fit === "in"}
              onclick={() => (pparams.boxCylinder.fit = "in")}>internal</button>
            <button type="button" class:on={pparams.boxCylinder.fit === "out"}
              onclick={() => (pparams.boxCylinder.fit = "out")}>external</button>
          </div>
        {/if}
      </fieldset>
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
  .hud .knobs { flex-wrap: wrap; }
  .hud .knobs label { display: flex; align-items: center; gap: 0.35rem; }
  .hud .knobs label span { opacity: 0.8; }
  nav { position: absolute; z-index: 2; padding: 0.6rem 0.9rem; }
  .back { display: inline-flex; align-items: center; gap: 0.3rem; opacity: 0.85; }

  aside { overflow-y: auto; padding: 0.8rem; display: flex; flex-direction: column; gap: 0.7rem;
    background: color-mix(in srgb, var(--paper, #14171c) 92%, #000); }
  fieldset { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 0.5rem; padding: 0.6rem; }
  legend { padding: 0 0.3rem; font-weight: 600; opacity: 0.85; }
  label { display: flex; align-items: center; gap: 0.45rem; font-size: 0.78rem; margin: 0.2rem 0; }
  label > span:first-child { min-width: 5.5rem; opacity: 0.8; }
  label input[type="range"] { flex: 1; }
  output { min-width: 2.6rem; text-align: right; opacity: 0.8; font-variant-numeric: tabular-nums; }
  .grp { margin: 0.5rem 0 0.1rem; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.5; }
  .hint { margin: 0 0 0.4rem; font-size: 0.7rem; opacity: 0.55; }
  .chk { display: flex; align-items: center; gap: 0.4rem; margin: 0.2rem 0 0.5rem; }
  .chk input { flex: 0 0 auto; }
  .chk span { min-width: 0; }
  .tabs { display: flex; gap: 0.25rem; margin-top: 0.4rem; }
  .tabs button { flex: 1; }
  .tabs button.on { outline: 1px solid color-mix(in srgb, currentColor 40%, transparent); font-weight: 600; }
  .jlist { list-style: none; margin: 0.4rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .jlist button { width: 100%; text-align: left; }
  .jlist button.on { outline: 1px solid color-mix(in srgb, currentColor 40%, transparent); font-weight: 600; }
  .add { font-size: 0.75rem; opacity: 0.75; margin-left: 0.4rem; }
</style>
