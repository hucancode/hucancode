<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    setRadius,
    setAngleStart,
    setSweepAmt,
    setLineWidth,
    setClockwise,
    setWobble,
    setStrands,
    setInkFlow,
    setWidthEnd,
    setWidthOffset,
    setWidthRange,
    setWidthAnchor,
    setCartesian,
  } from "$lib/scenes/ink";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let radius = $state(0.6);
  let angleStart = $state(0.0);
  let sweepAmt = $state(1.0);
  let lineWidth = $state(0.3);
  let clockwise = $state(false);
  let wobble = $state(0.0);
  let strands = $state(1.5);
  let inkFlow = $state(0.5);
  let widthPreset = $state('custom');
  let widthEnd = $state(0.1);
  // smoothstep width step: offset = where the width drops along the stroke
  // (0 tip .. 1 tail), range = how soft the drop is (small = abrupt, large = gradual).
  let widthOffset = $state(0.5);
  let widthRange = $state(1.0);
  let widthAnchor = $state(1.0); // 0 = inside, 0.5 = center, 1 = outside
  let cartesian = $state(false); // false = polar (arc), true = cartesian (line)

  const widthPresets = {
    uniform:    { end: 1.0,  offset: 0.5,  range: 1.0 },  // no taper (end = tip width)
    linear:     { end: 0.0,  offset: 0.5,  range: 1.0 },  // gentle full-length taper
    easeOut:    { end: 0.0,  offset: 0.75, range: 0.5 },  // stays thick, drops late
    easeIn:     { end: 0.0,  offset: 0.25, range: 0.5 },  // drops early, thin most
    custom:     null,
  };

  $effect(() => {
    if (widthPreset === "custom") return;
    const p = widthPresets[widthPreset];
    if (!p) return;
    widthEnd = p.end;
    widthOffset = p.offset;
    widthRange = p.range;
  });

  $effect(() => { if (ready) setRadius(radius); });
  $effect(() => { if (ready) setAngleStart(angleStart); });
  $effect(() => { if (ready) setSweepAmt(sweepAmt); });
  $effect(() => { if (ready) setLineWidth(lineWidth); });
  $effect(() => { if (ready) setClockwise(clockwise); });
  $effect(() => { if (ready) setWobble(wobble); });
  $effect(() => { if (ready) setStrands(strands); });
  $effect(() => { if (ready) setInkFlow(inkFlow); });
  $effect(() => { if (ready) setWidthEnd(widthEnd); });
  $effect(() => { if (ready) setWidthOffset(widthOffset); });
  $effect(() => { if (ready) setWidthRange(widthRange); });
  $effect(() => { if (ready) setWidthAnchor(widthAnchor); });
  $effect(() => { if (ready) setCartesian(cartesian); });

  function loop() {
    frameID = requestAnimationFrame(loop);
    render();
  }

  function onResize() {
    if (!canvasEl) return;
    resize(canvasEl.clientWidth, canvasEl.clientHeight);
  }

  onMount(() => {
    init(canvasEl);
    ready = true;
    onResize();
    window.addEventListener("resize", onResize);
    observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        frameID = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(frameID);
      }
    });
    observer.observe(canvasEl);
  });

  onDestroy(() => {
    if (!browser) return;
    cancelAnimationFrame(frameID);
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
    destroy();
  });
</script>

<div class="ink-demo">
  <div class="stage">
    <canvas bind:this={canvasEl}></canvas>
  </div>
  <div class="controls">
    <label>
      <span>Radius</span>
      <input type="range" min="0.1" max="0.95" step="0.001" bind:value={radius} />
      <output>{radius.toFixed(3)}</output>
    </label>
    <label>
      <span>Angle Start</span>
      <input type="range" min="-6.283" max="6.283" step="0.001" bind:value={angleStart} />
      <output>{angleStart.toFixed(2)}</output>
    </label>
    <label>
      <span>Sweep Amt</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={sweepAmt} />
      <output>{sweepAmt.toFixed(2)}</output>
    </label>
    <label>
      <span>Line Width</span>
      <input type="range" min="0.01" max="0.6" step="0.001" bind:value={lineWidth} />
      <output>{lineWidth.toFixed(3)}</output>
    </label>
    <label>
      <span>Wobble</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
      <output>{wobble.toFixed(2)}</output>
    </label>
    <label>
      <span>Strands</span>
      <input type="range" min="0.1" max="4" step="0.01" bind:value={strands} />
      <output>{strands.toFixed(2)}</output>
    </label>
    <label>
      <span>Ink Flow</span>
      <input type="range" min="0.2" max="3" step="0.01" bind:value={inkFlow} />
      <output>{inkFlow.toFixed(2)}</output>
    </label>
    <hr />
    <label>
      <span>Width Shape</span>
      <select bind:value={widthPreset}>
        <option value="uniform">Uniform</option>
        <option value="linear">Linear</option>
        <option value="easeOut">Ease-out</option>
        <option value="easeIn">Ease-in</option>
        <option value="custom">Custom</option>
      </select>
      <output></output>
    </label>
    <label>
      <span>Tail width</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthEnd}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthEnd.toFixed(2)}</output>
    </label>
    <label>
      <span>Step offset</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthOffset}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthOffset.toFixed(2)}</output>
    </label>
    <label>
      <span>Step range</span>
      <input
        type="range" min="0" max="1.5" step="0.01"
        bind:value={widthRange}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthRange.toFixed(2)}</output>
    </label>
    <label>
      <span>Anchor</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={widthAnchor} />
      <output>{widthAnchor.toFixed(2)}</output>
    </label>
    <hr />
    <label class="check">
      <input type="checkbox" bind:checked={clockwise} />
      <span>clockwise</span>
    </label>
    <div class="square" role="group">
      <label><input type="radio" name="coord" value={false} bind:group={cartesian} /> polar</label>
      <label><input type="radio" name="coord" value={true}  bind:group={cartesian} /> cartesian</label>
    </div>
  </div>
</div>

<style>
  .ink-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media(min-width: 768px) {
    .ink-demo {
      flex-direction: row;
    }
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
  canvas {
    width: 100%;
    height: 100%;
    background: #fffce0;
    border-radius: 0.25rem;
    touch-action: none;
    display: block;
  }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  label {
    display: grid;
    grid-template-columns: 6rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  label.check {
    grid-template-columns: auto 1fr;
  }
  input[type="range"] { width: 100%; }
</style>
