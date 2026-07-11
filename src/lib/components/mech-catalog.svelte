<script>
  // The catalog panels both mech playgrounds share: the JOINT blocks and the
  // PRIMITIVE blocks they are built from. Neither depends on a rig, so the
  // dragon and atlas pages mount the same component and only differ in their
  // own rig tab. `view` picks which panel shows; `model` and `sel` bind back
  // out so the page can frame the scene.
  import Sliders from "./mech-sliders.svelte";
  import {
    JOINT_NAMES, JOINT_PARAMS, JOINT_POSE, jointCatalogModel,
  } from "$lib/mech/joint-catalog.js";
  import { primitiveModel, PRIM_PARAMS, PRIM_NAMES } from "$lib/mech/primitives-catalog.js";

  let { view, seed = 1, model = $bindable(null), sel = $bindable("") } = $props();

  const JOINTS = JOINT_NAMES;

  let selJoint = $state(JOINTS[0]);
  let selPrim = $state(PRIM_NAMES[0]);
  let jparams = $state(structuredClone(JOINT_PARAMS));
  let jpose = $state(structuredClone(JOINT_POSE));      // DOF channels, degrees
  let pparams = $state(structuredClone(PRIM_PARAMS));

  const JOINT_LABELS = {
    hinge: "hinge", hingeTwist: "hinge + twist", discHinge: "disc hinge",
    wrist: "wrist (2 pins + twist)",
    pin: "bare pin", ball: "ball", pivot: "pivot", prismatic: "prismatic",
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
  const CLEVIS = [["jaw", "clevis jaw", 0.1, 0.6], ["lugT", "lug thickness", 0.05, 0.3], ["lugL", "lug length", 0.3, 1.2], ["lugD", "lug depth", 0.2, 1.2], ["pinR", "pin radius", 0.06, 0.24], ["pinOut", "pin overhang", 0, 0.2], ["flangeT", "flange thickness", 0.08, 0.5], ["clr", "lug clearance", 0.004, 0.08]];
  const JOINT_CTL = {
    hinge: [...CLEVIS, ["tang", "solid tang", 0, 1, 1], ["discF", "female disc base", 0, 1, 1], ["discM", "male disc base", 0, 1, 1]],
    hingeTwist: [...CLEVIS, ["tang", "solid tang", 0, 1, 1], ["discF", "female disc base", 0, 1, 1]],
    discHinge: CLEVIS,
    wrist: [...CLEVIS, ["tang", "solid tang", 0, 1, 1], ["discF", "top disc base", 0, 1, 1], ["discMid", "middle disc base", 0, 1, 1], ["discM", "bottom disc base", 0, 1, 1]],
    pin: [["pinR", "pin radius", 0.04, 0.24], ["jaw", "span", 0.05, 0.6], ["lugT", "lug thickness", 0.02, 0.3], ["clr", "clearance", 0.004, 0.08], ["pinOut", "pin overhang", 0, 0.2]],
    pivot: [["barrelR", "barrel radius", 0.12, 0.6], ["barrelLen", "barrel length", 0.3, 1.8], ["flangeR", "flange radius", 0.2, 0.9], ["neckR", "neck radius", 0.08, 0.4], ["neckLen", "neck length", 0.05, 0.5], ["capR", "cap radius", 0.12, 0.6]],
    prismatic: [["sleeveW", "sleeve width", 0.2, 1.0], ["sleeveLen", "sleeve length", 0.3, 1.5], ["sleeveD", "sleeve depth", 0.2, 1.0], ["ramW", "ram width", 0.1, 0.7], ["ramLen", "ram length", 0.2, 1.5]],
    ball: [["ballR", "ball radius", 0.15, 0.6], ["socketT", "socket wall", 0.05, 0.25], ["cut", "socket mouth", 0.4, 0.9], ["studR", "stud radius", 0.05, 0.25], ["studLen", "stud length", 0.1, 0.9], ["flangeW", "flange width", 0.4, 1.6], ["disc", "disc base", 0, 1, 1]],
  };
  // one slider per DOF — the same channels a rig's bones bind to (degrees; the
  // prismatic slide is a distance, hence its sub-degree step)
  const POSE_CTL = {
    hinge: [["swing", "swing (pin)", -90, 90, 1]],
    pin: [["swing", "swing (pin)", -90, 90, 1]],
    hingeTwist: [["swing", "swing (pin)", -90, 90, 1], ["twist", "twist (disc)", -180, 180, 1]],
    discHinge: [["spinF", "female disc spin", -180, 180, 1], ["swing", "swing (pin)", -90, 90, 1], ["spinM", "male disc spin", -180, 180, 1]],
    wrist: [["bend", "bend (pin 1)", -90, 90, 1], ["tilt", "tilt (pin 2)", -90, 90, 1], ["twist", "twist (disc)", -180, 180, 1]],
    pivot: [["spin", "spin", -180, 180, 1]],
    prismatic: [["slide", "slide", 0, 0.5, 0.01]],
    ball: [["rx", "rotate x", -50, 50, 1], ["ry", "rotate y", -180, 180, 1], ["rz", "rotate z", -50, 50, 1]],
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
    jparams[selJoint] = structuredClone(JOINT_PARAMS[selJoint]);
    jpose[selJoint] = structuredClone(JOINT_POSE[selJoint]);
  }
  function resetPrim() { pparams[selPrim] = structuredClone(PRIM_PARAMS[selPrim]); }

  $effect(() => { sel = view === "blocks" ? selPrim : selJoint; });
  $effect(() => {
    model = view === "blocks"
      ? primitiveModel(selPrim, $state.snapshot(pparams)[selPrim], seed)
      : jointCatalogModel(selJoint, seed, $state.snapshot(jparams)[selJoint], $state.snapshot(jpose)[selJoint]);
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
