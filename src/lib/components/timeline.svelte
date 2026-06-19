<script>
  import { onMount, onDestroy } from "svelte";
  import rough from "roughjs";

  let { progress = 0, onseek = null } = $props();

  let host, svgEl, ro, rs;
  let playedEl, handleEl;
  let geom = { x0: 2, x1: 0, w: 0 };
  let dragging = false;

  // build rough geometry ONCE (per size). Expensive part — never per frame.
  function build() {
    if (!host || !svgEl) return;
    const w = host.clientWidth, h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const y = h / 2, x0 = 2, x1 = w - 2;
    geom = { x0, x1, w };
    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.setAttribute("width", w);
    svgEl.setAttribute("height", h);
    svgEl.replaceChildren();
    rs = rough.svg(svgEl);
    // unplayed baseline, full width, lowkey
    svgEl.appendChild(
      rs.line(x0, y, x1, y, { stroke: "#6b6450", strokeWidth: 2, roughness: 1.0, bowing: 0, seed: 7 })
    );
    // played portion, full width — revealed by clip-path
    playedEl = rs.line(x0, y, x1, y, { stroke: "#c1666b", strokeWidth: 4.5, roughness: 1.4, bowing: 1, seed: 13 });
    svgEl.appendChild(playedEl);
    // hand-drawn handle, drawn at origin, moved by transform
    handleEl = rs.circle(0, y, 14, { stroke: "#d4b483", strokeWidth: 2, fill: "#c1666b", fillStyle: "solid", roughness: 1.2, seed: 21 });
    svgEl.appendChild(handleEl);
    place();
  }

  // cheap per-frame update: move handle + clip played. No rough regen.
  function place() {
    if (!playedEl || !handleEl) return;
    const { x0, x1 } = geom;
    const p = Math.min(1, Math.max(0, progress));
    const px = x0 + (x1 - x0) * p;
    handleEl.setAttribute("transform", `translate(${px},0)`);
    playedEl.style.clipPath = `inset(0 ${Math.max(0, x1 - px)}px 0 0)`;
  }

  function seekAt(clientX) {
    const r = host.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onseek && onseek(p);
  }
  function onDown(e) { dragging = true; host.setPointerCapture?.(e.pointerId); seekAt(e.clientX); }
  function onMove(e) { if (dragging) seekAt(e.clientX); }
  function onUp() { dragging = false; }

  onMount(() => {
    build();
    ro = new ResizeObserver(() => build());
    ro.observe(host);
  });
  onDestroy(() => ro && ro.disconnect());

  // progress change → cheap reposition only
  $effect(() => {
    progress;
    place();
  });
</script>

<div
  bind:this={host}
  role="slider"
  aria-label="scene timeline"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(progress * 100)}
  tabindex="0"
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={onUp}
  onpointerleave={onUp}
>
  <svg bind:this={svgEl} aria-hidden="true"></svg>
</div>

<style>
  div {
    position: relative;
    flex: 1;
    height: 20px;
    min-width: 80px;
    cursor: pointer;
    touch-action: none;
  }
  svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }
</style>
