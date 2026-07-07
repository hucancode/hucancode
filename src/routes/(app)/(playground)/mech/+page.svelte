<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import {
    partModel, primitiveModel,
    PART_NAMES, PRIM_NAMES, PRIM_PARAMS, PART_PARAMS, JOINT_POSE,
  } from "$lib/mech/parts.js";
  import { dragonModel, DRAGON_POSE } from "$lib/mech/rig.js";
  import { assembleModel } from "$lib/mech/assembly.js";

  let scene = $state(null);

  // joints live in the parts tab (a joint is a catalog part in its own right)
  const JOINTS = ["hinge1", "hinge2", "hinge3", "pivot1", "ball1"];
  const PARTS = PART_NAMES.filter((n) => !JOINTS.includes(n));

  let view = $state("dragon");            // "parts" | "primitives" | "dragon"
  let selPart = $state(PARTS[0]);         // a part OR a joint name
  let selPrim = $state(PRIM_NAMES[0]);
  const isJoint = (n) => JOINTS.includes(n);
  let pparams = $state(structuredClone(PRIM_PARAMS));
  let jparams = $state(structuredClone(PART_PARAMS));
  let jpose = $state(structuredClone(JOINT_POSE));   // runtime joint rotations, degrees
  let drig = $state(structuredClone(DRAGON_POSE));   // dragon rig pose
  let autoplay = $state(true);                       // fly the loop automatically
  const LAP_SECONDS = 4;
  // assembly build scrub: 1 = fully assembled, <1 runs the 4-phase build
  let asm = $state(0);
  let asmPlay = $state(true);
  const BUILD_SECONDS = 6;
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
    pivot1: "pivot 1",
    ball1: "ball 1",
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

  const model = $derived.by(() => {
    if (view === "primitives") return primitiveModel(selPrim, $state.snapshot(pparams)[selPrim], seed);
    if (view === "dragon") {
      const pose = $state.snapshot(drig);
      const m = dragonModel(seed, pose);
      if (asm >= 1) return m;
      const dOff = autoplay ? BUILD_SECONDS / LAP_SECONDS : 0;
      return { ...m, items: assembleModel(m.items, asm, asmRefAt(pose, dOff)) };
    }
    if (isJoint(selPart)) return partModel(selPart, seed, $state.snapshot(jparams)[selPart], $state.snapshot(jpose)[selPart]);
    return partModel(selPart, seed, $state.snapshot(jparams)[selPart]);
  });
  $effect(() => { scene?.apply({ spin }); });
  $effect(() => { scene?.apply({ lightAngle: light }); });
  $effect(() => { scene?.apply({ model }); });
  // fixed per-view distance (no auto-fit): the dragon rides a big loop
  $effect(() => { selPart; selPrim; scene?.apply({ resetView: true, dist: view === "dragon" ? 24 : 6 }); });
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
    if (!autoplay || view !== "dragon") return;
    return driveRaf((dt) => {
      drig.offset = (drig.offset + dt / LAP_SECONDS) % 1;
    });
  });
  // replay build: sweep the assembly scrub 0 -> 1 once
  $effect(() => {
    if (!asmPlay || view !== "dragon") return;
    return driveRaf((dt) => {
      asm = Math.min(1, asm + dt / BUILD_SECONDS);
      if (asm >= 1) { asmPlay = false; return false; }
    });
  });
</script>

<svelte:head><title>Mech</title></svelte:head>

  <section>
    <Scene bind:this={scene} scene={mech} id="mech" />
    <footer>
      {#if view === "dragon"}
        <div>
          <button type="button" onclick={playAssemble}>▶ Assemble</button>
          <input type="range" min="0" max="1" step="0.001" bind:value={asm} onpointerdown={grabAsm} />
          <output>{asm.toFixed(2)}</output>
        </div>
      {/if}
      <div>
        <label><span>Spin</span><input type="range" min="0" max="3" step="0.1" bind:value={spin} /></label>
        <label><span>Light</span><input type="range" min="0" max="6.28" step="0.05" bind:value={light} /></label>
        <button type="button" onclick={shuffle}>New Color</button>
      </div>
    </footer>
  </section>

  <aside>
    <fieldset>
      <legend>view</legend>
      <div role="group">
        <label><input type="radio" name="mech-view" value="parts" bind:group={view} />parts</label>
        <label><input type="radio" name="mech-view" value="primitives" bind:group={view} />blocks</label>
        <label><input type="radio" name="mech-view" value="dragon" bind:group={view} />dragon</label>
      </div>
    </fieldset>

    {#if view === "parts"}
      <fieldset>
        <legend>parts</legend>
        <ul>
          {#each PARTS as pn}
            <li><label><input type="radio" name="mech-part" value={pn} bind:group={selPart} />{PART_LABELS[pn] ?? pn}</label></li>
          {/each}
        </ul>
        <hr/>
        <ul>
          {#each JOINTS as jn}
            <li><label><input type="radio" name="mech-part" value={jn} bind:group={selPart} />{PART_LABELS[jn] ?? jn}</label></li>
          {/each}
        </ul>
      </fieldset>
      <fieldset>
        <legend>params<button type="button" onclick={resetJointParams}>reset</button></legend>
        {#each PART_CTL[selPart] as [key, label, min, max, step]}
          <label><span>{label}</span>
            <input type="range" {min} {max} step={step ?? 0.01} value={jparams[selPart][key]}
              oninput={(e) => (jparams[selPart][key] = +e.currentTarget.value)} />
            <output>{jparams[selPart][key].toFixed(step ? 0 : 2)}</output></label>
        {/each}
        {#if isJoint(selPart)}
          <fieldset>
            <legend>runtime pose — joint rotations</legend>
            {#each POSE_CTL[selPart] as [key, label, min, max]}
              <label><span>{label}</span>
                <input type="range" {min} {max} step="1" value={jpose[selPart][key]}
                  oninput={(e) => (jpose[selPart][key] = +e.currentTarget.value)} />
                <output>{jpose[selPart][key].toFixed(0)}</output></label>
            {/each}
          </fieldset>
        {/if}
      </fieldset>
    {:else if view === "dragon"}
      <fieldset>
        <legend>rig<button type="button" onclick={resetDragon}>reset</button></legend>
        <label><input type="checkbox" bind:checked={autoplay} /><span>autoplay</span></label>
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
        <ul>
          {#each PRIM_NAMES as pn}
            <li><label><input type="radio" name="mech-prim" value={pn} bind:group={selPrim} />{PRIM_LABELS[pn] ?? pn}</label></li>
          {/each}
        </ul>
      </fieldset>
      <fieldset>
        <legend>{PRIM_LABELS[selPrim] ?? selPrim} params <button type="button" onclick={resetParams}>reset</button></legend>
        {#each PRIM_CTL[selPrim] as [key, label, min, max]}
          <label><span>{label}</span>
            <input type="range" {min} {max} step="0.01" value={pparams[selPrim][key]}
              oninput={(e) => (pparams[selPrim][key] = +e.currentTarget.value)} />
            <output>{pparams[selPrim][key].toFixed(2)}</output></label>
        {/each}
        {#if selPrim === "boxCylinder"}
          <fieldset>
            <legend>cylinder fit</legend>
            <div role="group">
              <label><input type="radio" name="mech-fit" value="in" bind:group={pparams.boxCylinder.fit} />internal</label>
              <label><input type="radio" name="mech-fit" value="out" bind:group={pparams.boxCylinder.fit} />external</label>
            </div>
          </fieldset>
        {/if}
      </fieldset>
    {/if}
  </aside>
