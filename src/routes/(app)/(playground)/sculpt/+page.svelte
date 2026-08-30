<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as mech from "$lib/playgrounds/mech";
  import { SHAPE_NAMES, SHAPE_PARAMS, sculptModel, DESIGN_SAMPLE } from "$lib/mech/sculpt-catalog.js";
  import { SCULPT_DEFAULTS, SCULPT_NOTATION } from "$lib/mech/sculpt.js";

  let scene = $state(null);

  const RENDER_CTL = [
    ["spin", "spin", 0, 3, 0.1],
    ["light", "light angle", 0, 6.28, 0.05],
    ["wire", "wireframe", 0, 1],
  ];
  const SHAPE_LABELS = { box: "box", cylinder: "cylinder", sphere: "sphere" };
  // [key, label, min, max, step?] — the face the sculpt lands on
  const SHAPE_CTL = {
    box: [["w", "width", 0.5, 3], ["h", "height", 0.5, 3], ["d", "depth", 0.5, 3]],
    cylinder: [["r", "radius", 0.3, 1.5], ["h", "height", 0.5, 3]],
    sphere: [["r", "radius", 0.4, 1.5]],
  };
  // the sculpt itself. `cell` is a world length, so panels keep their size when
  // the shape grows; `cuts` at 1 carves every panel in, at 0 raises every one.
  const SCULPT_CTL = [
    ["cell", "sculpt size", 0.15, 1.5],
    ["size", "panel fill", 0.2, 0.95],
    ["depth", "depth", 0, 0.3],
    ["slant", "45° slant", 0, 1],
    ["density", "density", 0, 1],
    ["merge", "merge plates", 0, 1],
    ["cuts", "cut vs extrude", 0, 1],
  ];
  // a design fixes the layout, so the dice that would have rolled it go quiet
  const DESIGNED = new Set(["density", "merge", "cuts", "cell"]);
  // studs: the cylindrical greebles. bossCuts at 1 bores every one in as a
  // hole, at 0 stands every one out as a stub.
  const BOSS_CTL = [
    ["boss", "stud mix", 0, 1],
    ["bossR", "stud radius", 0.1, 1],
    ["bossH", "stud depth", 0, 0.4],
    ["bossCuts", "hole vs stud", 0, 1],
  ];

  let shape = $state(SHAPE_NAMES[0]);
  let sparams = $state(structuredClone(SHAPE_PARAMS));
  let sculpt = $state(structuredClone(SCULPT_DEFAULTS));
  let seed = $state(1);                     // color shuffle seed
  let render = $state({ spin: 0.3, light: 0.6, wire: 0 });
  let drawn = $state(false);                // hand-drawn design instead of dice
  let design = $state(DESIGN_SAMPLE);

  function resetShape() { sparams[shape] = structuredClone(SHAPE_PARAMS[shape]); }
  function resetSculpt() { sculpt = structuredClone(SCULPT_DEFAULTS); }
  function reseed() { sculpt.seed = (sculpt.seed + 1) | 0; }
  function shuffle() { seed = (seed + 1) | 0; }

  const model = $derived(
    sculptModel(
      shape,
      $state.snapshot(sparams)[shape],
      { ...$state.snapshot(sculpt), design: drawn ? design : null },
      seed,
    ),
  );
  $effect(() => {
    scene?.apply({ spin: render.spin, lightAngle: render.light, wire: render.wire, model });
  });
  // fixed framing, no auto-fit: one block sits close in, like the blocks catalog
  $effect(() => { shape; scene?.apply({ resetView: true, dist: 6 }); });
</script>

<svelte:head><title>Sculpt</title></svelte:head>

<section>
  <Scene bind:this={scene} scene={mech} id="sculpt" />
</section>

<aside>
  <fieldset>
    <legend>shape</legend>
    <ul>
      {#each SHAPE_NAMES as sn}
        <li><label><input type="radio" name="sculpt-shape" value={sn} bind:group={shape} />{SHAPE_LABELS[sn] ?? sn}</label></li>
      {/each}
    </ul>
  </fieldset>

  <fieldset>
    <legend>{SHAPE_LABELS[shape] ?? shape} <button type="button" onclick={resetShape}>reset</button></legend>
    {#each SHAPE_CTL[shape] as [key, label, min, max, step]}
      <label><span>{label}</span>
        <input type="range" {min} {max} step={step ?? 0.01} value={sparams[shape][key]}
          oninput={(e) => (sparams[shape][key] = +e.currentTarget.value)} />
        <output>{sparams[shape][key].toFixed(2)}</output></label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>sculpt <button type="button" onclick={resetSculpt}>reset</button></legend>
    {#each SCULPT_CTL as [key, label, min, max, step]}
      <label><span>{label}</span>
        <input type="range" {min} {max} step={step ?? 0.01} value={sculpt[key]}
          disabled={drawn && DESIGNED.has(key)}
          oninput={(e) => (sculpt[key] = +e.currentTarget.value)} />
        <output>{sculpt[key].toFixed(2)}</output></label>
    {/each}
    <label><input type="checkbox" checked={!!sculpt.mirror} disabled={drawn}
      onchange={(e) => (sculpt.mirror = e.currentTarget.checked ? 1 : 0)} /><span>mirror x</span></label>
    <menu><li><button type="button" onclick={reseed} disabled={drawn}>new sculpt</button></li></menu>
  </fieldset>

  <fieldset>
    <legend>design</legend>
    <label><input type="checkbox" bind:checked={drawn} /><span>draw it myself</span></label>
    {#if drawn}
      <pre>{SCULPT_NOTATION}</pre>
      <textarea rows="8" spellcheck="false" bind:value={design}></textarea>
    {/if}
  </fieldset>

  <fieldset>
    <legend>studs &amp; holes</legend>
    {#each BOSS_CTL as [key, label, min, max, step]}
      <label><span>{label}</span>
        <input type="range" {min} {max} step={step ?? 0.01} value={sculpt[key]}
          oninput={(e) => (sculpt[key] = +e.currentTarget.value)} />
        <output>{sculpt[key].toFixed(2)}</output></label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>render</legend>
    {#each RENDER_CTL as [key, label, min, max, step]}
      <label><span>{label}</span>
        <input type="range" {min} {max} step={step ?? 0.01} value={render[key]}
          oninput={(e) => (render[key] = +e.currentTarget.value)} />
        <output>{render[key].toFixed(2)}</output></label>
    {/each}
    <menu><li><button type="button" onclick={shuffle}>new color</button></li></menu>
  </fieldset>
</aside>

<style>
  /* the design is a picture of the face: it only reads if the columns line up */
  aside textarea {
    width: 100%;
    font-family: ui-monospace, monospace;
    line-height: 1.35;
    letter-spacing: 0.15em;
    resize: vertical;
  }
  aside pre {
    margin: 0 0 0.4rem;
    font-size: 0.75rem;
    line-height: 1.4;
    opacity: 0.75;
    white-space: pre-wrap;
  }
  aside small { opacity: 0.6; }
</style>
