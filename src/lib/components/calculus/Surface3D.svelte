<script>
  import { clamp } from "$lib/playgrounds/calculus/plot.js";

  let {
    fn,
    domain = 6,
    resolution = 32,
    width = 440,
    height = 360,
    yaw0 = -0.5,
    pitch0 = 0.75,
    scale = 26,
    zScale = 1,
    ariaLabel = "3D surface",
    showGround = true,
    children = null,
  } = $props();

  const CX = width / 2;
  const CY = height / 2;

  // World-space grid: [x, y, z] with z = fn(x, y). project() applies zScale
  // (display-only vertical exaggeration) so surface and overlays stay aligned.
  let grid = $derived.by(() => {
    const D = domain;
    const N = resolution;
    const g = new Array(N);
    for (let i = 0; i < N; i++) {
      const row = new Array(N);
      const x = -D + (2 * D * i) / (N - 1);
      for (let j = 0; j < N; j++) {
        const y = -D + (2 * D * j) / (N - 1);
        row[j] = [x, y, fn(x, y)];
      }
      g[i] = row;
    }
    return g;
  });

  let yaw = $state(yaw0);
  let pitch = $state(pitch0);
  let dragging = $state(false);
  let lastX = 0;
  let lastY = 0;

  // Rotation basis, recomputed when the view changes.
  let rot = $derived.by(() => {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    return { cy, sy, cp, sp };
  });

  /** Project a world point (x, y, z) to screen coordinates {x, y}. */
  function project(x, y, z) {
    const { cy, sy, cp, sp } = rot;
    const x1 = x * cy - y * sy; // yaw
    const y1 = x * sy + y * cy;
    const zz = z * zScale; // display-only vertical exaggeration
    const y2 = y1 * cp + zz * sp; // pitch (screen-up axis)
    return { x: CX + x1 * scale, y: CY - y2 * scale };
  }

  // Wireframe "net": two polylines (constant-x and constant-y grid lines),
  // merged into a single path each. No fill, no shading.
  let wireX = $derived.by(() => {
    const g = grid;
    const N = resolution;
    let d = "";
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const s = project(g[i][j][0], g[i][j][1], g[i][j][2]);
        d += `${j === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
      }
    }
    return d;
  });

  let wireY = $derived.by(() => {
    const g = grid;
    const N = resolution;
    let d = "";
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const s = project(g[i][j][0], g[i][j][1], g[i][j][2]);
        d += `${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`;
      }
    }
    return d;
  });

  // Ground reference: domain boundary square + the x/y axes, all at z = 0.
  let ground = $derived.by(() => {
    const D = domain;
    const c00 = project(-D, -D, 0);
    const c10 = project(D, -D, 0);
    const c11 = project(D, D, 0);
    const c01 = project(-D, D, 0);
    const xa = project(-D, 0, 0);
    const xb = project(D, 0, 0);
    const ya = project(0, -D, 0);
    const yb = project(0, D, 0);
    return {
      boundary:
        `M${c00.x.toFixed(1)},${c00.y.toFixed(1)}` +
        `L${c10.x.toFixed(1)},${c10.y.toFixed(1)}` +
        `L${c11.x.toFixed(1)},${c11.y.toFixed(1)}` +
        `L${c01.x.toFixed(1)},${c01.y.toFixed(1)}Z`,
      xAxis: { x1: xa.x, y1: xa.y, x2: xb.x, y2: xb.y },
      yAxis: { x1: ya.x, y1: ya.y, x2: yb.x, y2: yb.y },
    };
  });

  function onDown(e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMove(e) {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.008;
    pitch = clamp(pitch - (e.clientY - lastY) * 0.008, 0.15, 1.45);
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onUp() {
    dragging = false;
  }

  $effect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  });
</script>

<svg
  class="graph surface3d"
  viewBox={`0 0 ${width} ${height}`}
  role="img"
  aria-label={ariaLabel}
  onpointerdown={onDown}
>
  <rect class="bg" x="0" y="0" width={width} height={height} />

  {#if showGround}
    <g class="ground">
      <path class="boundary" d={ground.boundary} />
      <line class="axis" x1={ground.xAxis.x1} y1={ground.xAxis.y1} x2={ground.xAxis.x2} y2={ground.xAxis.y2} />
      <line class="axis" x1={ground.yAxis.x1} y1={ground.yAxis.y1} x2={ground.yAxis.x2} y2={ground.yAxis.y2} />
    </g>
  {/if}

  <g class="net">
    <path class="wire" d={wireX} />
    <path class="wire" d={wireY} />
  </g>

  {#if children}
    {@render children({ project })}
  {/if}
</svg>
