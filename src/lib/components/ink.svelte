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
    setTaper,
    setWobble,
    setWidthEnd,
    setWidthTaperPow,
    setWidthAnchor,
  } from "$lib/scenes/ink";

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  let radius = $state(0.6);
  let angleStart = $state(0.2);
  let sweepAmt = $state(0.92);
  let lineWidth = $state(0.3);
  let clockwise = $state(false);
  let taper = $state(10.0);
  let wobble = $state(0.8);
  let widthPreset = $state("uniform");
  let widthEnd = $state(1.0);
  let widthTaperPow = $state(1.0);
  let widthAnchor = $state(0.5); // 0 = inside, 0.5 = center, 1 = outside

  const widthPresets = {
    uniform:    { end: 1.0,  pow: 1.0 },
    linear:     { end: 0.0,  pow: 1.0 },
    easeOut:    { end: 0.0,  pow: 2.5 },   // stays thick, drops near tail
    easeIn:     { end: 0.0,  pow: 0.4 },   // drops fast, thin most of stroke
    custom:     null,
  };

  $effect(() => {
    if (widthPreset === "custom") return;
    const p = widthPresets[widthPreset];
    if (!p) return;
    widthEnd = p.end;
    widthTaperPow = p.pow;
  });

  $effect(() => { if (ready) setRadius(radius); });
  $effect(() => { if (ready) setAngleStart(angleStart); });
  $effect(() => { if (ready) setSweepAmt(sweepAmt); });
  $effect(() => { if (ready) setLineWidth(lineWidth); });
  $effect(() => { if (ready) setClockwise(clockwise); });
  $effect(() => { if (ready) setTaper(taper); });
  $effect(() => { if (ready) setWobble(wobble); });
  $effect(() => { if (ready) setWidthEnd(widthEnd); });
  $effect(() => { if (ready) setWidthTaperPow(widthTaperPow); });
  $effect(() => { if (ready) setWidthAnchor(widthAnchor); });

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
      <input type="range" min="0" max="6.283" step="0.001" bind:value={angleStart} />
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
      <span>Taper</span>
      <input type="range" min="1" max="16" step="0.1" bind:value={taper} />
      <output>{taper.toFixed(1)}</output>
    </label>
    <label>
      <span>Wobble</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={wobble} />
      <output>{wobble.toFixed(2)}</output>
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
      <span>Taper curve</span>
      <input
        type="range" min="0.1" max="6" step="0.01"
        bind:value={widthTaperPow}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthTaperPow.toFixed(2)}</output>
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
  </div>
</div>

<style>
  .ink-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
