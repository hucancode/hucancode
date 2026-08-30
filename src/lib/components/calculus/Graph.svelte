<script>
  let {
    children,
    xMin = -4,
    xMax = 4,
    yMin = -4,
    yMax = 4,
    width = 660,
    height = 380,
    pad = 46,
    ariaLabel = "Function graph",
    onSeek = null,
  } = $props();

  const W = width;
  const H = height;
  const left = pad;
  const right = W - pad;
  const top = pad;
  const bottom = H - pad;
  const plotW = right - left;
  const plotH = bottom - top;

  const sx = (x) => left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y) => top + ((yMax - y) / (yMax - yMin)) * plotH;
  const ix = (px) => xMin + ((px - left) / plotW) * (xMax - xMin);
  const iy = (py) => yMax - ((py - top) / plotH) * (yMax - yMin);

  const scale = { x: sx, y: sy, ix, iy, left, right, top, bottom };

  function niceStep(range, target = 7) {
    const raw = range / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    const f = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return f * mag;
  }
  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);
  const xTicks = [];
  for (let t = Math.ceil(xMin / xStep) * xStep; t <= xMax + xStep * 1e-6; t += xStep) xTicks.push(t);
  const yTicks = [];
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax + yStep * 1e-6; t += yStep) yTicks.push(t);
  const fmt = (t) => {
    const r = Math.round(t * 1e6) / 1e6;
    return Object.is(r, -0) ? "0" : String(r);
  };
  const xLabelY = Math.min(Math.max(sy(0) + 15, top + 10), bottom + 18);
  const yLabelX = Math.min(Math.max(sx(0) - 8, 8), left - 6);

  let svg = $state();
  let dragging = $state(false);

  function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
  }
  function toData(evt) {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const py = ((evt.clientY - rect.top) / rect.height) * H;
    return { x: ix(px), y: iy(py) };
  }
  function down(evt) {
    if (!onSeek) return;
    dragging = true;
    evt.currentTarget.setPointerCapture?.(evt.pointerId);
    const d = toData(evt);
    onSeek(clamp(d.x, xMin, xMax), d.y, evt);
  }
  function move(evt) {
    if (!dragging || !onSeek) return;
    const d = toData(evt);
    onSeek(clamp(d.x, xMin, xMax), d.y, evt);
  }
  function up() {
    dragging = false;
  }
</script>

<svg bind:this={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} class="graph">
  <rect x="0" y="0" width={W} height={H} class="bg" />

  <g class="grid">
    {#each xTicks as t}<line x1={sx(t)} y1={top} x2={sx(t)} y2={bottom} />{/each}
    {#each yTicks as t}<line x1={left} y1={sy(t)} x2={right} y2={sy(t)} />{/each}
  </g>

  <g class="axes">
    {#if 0 >= yMin && 0 <= yMax}
      <line x1={left} y1={sy(0)} x2={right} y2={sy(0)} />
    {/if}
    {#if 0 >= xMin && 0 <= xMax}
      <line x1={sx(0)} y1={top} x2={sx(0)} y2={bottom} />
    {/if}
  </g>

  <g class="ticks">
    {#each xTicks as t}<text x={sx(t)} y={xLabelY}>{fmt(t)}</text>{/each}
    {#each yTicks as t}<text x={yLabelX} y={sy(t) + 3} class="ytick">{fmt(t)}</text>{/each}
  </g>

  <!-- nested viewport clips plot content to the plot area (no ids needed) -->
  <svg
    class="viewport"
    x={left}
    y={top}
    width={plotW}
    height={plotH}
    viewBox={`${left} ${top} ${plotW} ${plotH}`}
    style="overflow: hidden"
  >
    {@render children?.(scale)}
  </svg>

  {#if onSeek}
    <rect
      class="overlay"
      x={left}
      y={top}
      width={plotW}
      height={plotH}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    ></rect>
  {/if}
</svg>
