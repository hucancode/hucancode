<script>
  // The catalog panels both mech playgrounds share: the JOINT blocks and the
  // PRIMITIVE blocks they are built from. Neither depends on a rig, so the
  // dragon and atlas pages mount the same component and only differ in their
  // own rig tab. `view` picks which panel shows; `model` and `sel` bind back
  // out so the page can frame the scene.
  import Sliders from "./mech-sliders.svelte";
  import { JOINT_KIT, JOINT_POSE } from "$lib/mech/joints.js";
  import { primitiveModel, PRIM_PARAMS, PRIM_NAMES } from "$lib/mech/blocks.js";

  let { view, seed = 1, model = $bindable(null), sel = $bindable("") } = $props();

  const JOINTS = JOINT_KIT.names;

  let selJoint = $state(JOINTS[0]);
  let selPrim = $state(PRIM_NAMES[0]);
  let jparams = $state(structuredClone(JOINT_KIT.params));
  let jpose = $state(structuredClone(JOINT_POSE));      // runtime joint rotations, degrees
  let pparams = $state(structuredClone(PRIM_PARAMS));

  const JOINT_LABELS = {
    hinge1: "hinge 1", hinge2: "hinge 2", pivot1: "pivot 1",
    prismatic1: "prismatic 1", ball1: "ball 1",
  };
  const PRIM_LABELS = {
    cylinder: "cylinder", cone: "cone", coneCut: "cut cone",
    box: "box", sphere: "sphere", hemisphere: "hemisphere",
    cutHemisphere: "cut hemisphere",
    halfCylinder: "half cylinder", halfCylinderBox: "arch box",
    quarterCylinder: "quarter disc",
    gear: "gear",
  };
  // [key, label, min, max, step?] sliders per joint; a 0/1/1 row is a flag
  const JOINT_CTL = {
    hinge1: [["gap", "arm gap", 0.1, 0.6], ["armT", "arm thickness", 0.05, 0.3], ["armH", "arm length", 0.3, 1.2], ["depth", "depth", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24], ["pinOut", "pin overhang", 0, 0.2], ["baseH", "base height", 0.08, 0.5], ["clr", "arm clearance", 0.004, 0.08], ["solid", "solid male", 0, 1, 1], ["discF", "female disc base", 0, 1, 1], ["discM", "male disc base", 0, 1, 1]],
    hinge2: [["gap", "arm gap", 0.1, 0.6], ["armT", "arm thickness", 0.05, 0.3], ["armH", "arm length", 0.3, 1.2], ["depth", "depth", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24], ["pinOut", "pin overhang", 0, 0.2], ["baseH", "base height", 0.08, 0.5], ["clr", "arm clearance", 0.004, 0.08], ["solid", "solid male", 0, 1, 1], ["discF", "top disc base", 0, 1, 1], ["discMid", "middle disc base", 0, 1, 1], ["discM", "bottom disc base", 0, 1, 1]],
    pivot1: [["barrelR", "barrel radius", 0.12, 0.6], ["barrelLen", "barrel length", 0.3, 1.8], ["flangeR", "flange radius", 0.2, 0.9], ["neckR", "neck radius", 0.08, 0.4], ["neckLen", "neck length", 0.05, 0.5], ["capR", "cap radius", 0.12, 0.6]],
    prismatic1: [["coverW", "cover width", 0.2, 1.0], ["coverLen", "cover length", 0.3, 1.5], ["coverD", "cover depth", 0.2, 1.0], ["shaftW", "shaft width", 0.1, 0.7], ["shaftLen", "shaft length", 0.2, 1.5]],
    ball1: [["ballR", "ball radius", 0.15, 0.6], ["socketT", "socket wall", 0.05, 0.25], ["cut", "socket cut", 0.4, 0.9], ["shaftR", "shaft radius", 0.05, 0.25], ["shaftLen", "shaft length", 0.1, 0.9], ["baseW", "base width", 0.4, 1.6], ["disc", "disc base", 0, 1, 1]],
  };
  // [key, label, min, max, step?] runtime rotation sliders per joint (degrees);
  // the prismatic slides are distances, hence their sub-degree step
  const POSE_CTL = {
    hinge1: [["swing", "swing", -90, 90, 1]],
    hinge2: [["rx", "rotate x", -90, 90, 1], ["rz", "rotate z", -90, 90, 1]],
    pivot1: [["spinA", "spin top", -180, 180, 1], ["spinB", "spin bottom", -180, 180, 1]],
    prismatic1: [["slideA", "slide top", 0, 0.5, 0.01], ["slideB", "slide bottom", 0, 0.5, 0.01]],
    ball1: [["rx", "rotate x", -50, 50, 1], ["ry", "rotate y", -180, 180, 1], ["rz", "rotate z", -50, 50, 1]],
  };
  // [key, label, min, max, step?] sliders per primitive
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
    quarterCylinder: [["r", "radius", 0.1, 1.2], ["h", "thickness", 0.05, 1.5]],
    // teeth counts are integers; a side under 3 teeth is flat (0 = plain ring)
    gear: [["r", "radius", 0.1, 1.2], ["h", "thickness", 0.05, 1.5], ["teethOut", "outer teeth", 0, 32, 1], ["teethIn", "inner teeth", 0, 32, 1]],
  };

  function resetJoint() {
    jparams[selJoint] = structuredClone(JOINT_KIT.params[selJoint]);
    jpose[selJoint] = structuredClone(JOINT_POSE[selJoint]);
  }
  function resetPrim() { pparams[selPrim] = structuredClone(PRIM_PARAMS[selPrim]); }

  $effect(() => { sel = view === "blocks" ? selPrim : selJoint; });
  $effect(() => {
    model = view === "blocks"
      ? primitiveModel(selPrim, $state.snapshot(pparams)[selPrim], seed)
      : JOINT_KIT.partModel(selJoint, seed, $state.snapshot(jparams)[selJoint], $state.snapshot(jpose)[selJoint]);
  });
</script>

{#if view === "blocks"}
  <fieldset>
    <legend>primitives</legend>
    <ul>
      {#each PRIM_NAMES as pn}
        <li><label><input type="radio" name="mech-prim" value={pn} bind:group={selPrim} />{PRIM_LABELS[pn] ?? pn}</label></li>
      {/each}
    </ul>
  </fieldset>
  <fieldset>
    <legend>{PRIM_LABELS[selPrim] ?? selPrim} params <button type="button" onclick={resetPrim}>reset</button></legend>
    <Sliders ctl={PRIM_CTL[selPrim]} values={pparams[selPrim]} />
  </fieldset>
{:else}
  <fieldset>
    <legend>joints</legend>
    <ul>
      {#each JOINTS as jn}
        <li><label><input type="radio" name="mech-joint" value={jn} bind:group={selJoint} />{JOINT_LABELS[jn] ?? jn}</label></li>
      {/each}
    </ul>
  </fieldset>
  <fieldset>
    <legend>params<button type="button" onclick={resetJoint}>reset</button></legend>
    <Sliders ctl={JOINT_CTL[selJoint]} values={jparams[selJoint]} />
    <hr />
    <Sliders ctl={POSE_CTL[selJoint]} values={jpose[selJoint]} />
  </fieldset>
{/if}
