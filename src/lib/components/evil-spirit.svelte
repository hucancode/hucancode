<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import {
    init,
    destroy,
    render,
    resize,
    updateSpirits,
    setStyle,
    screenToWorld,
  } from "$lib/scenes/evil-spirit";

  // dev toggle: when true, pickTarget chooses from FIXED_TURN_ANGLES instead of cone sampling
  const FIXED_TURN_MODE = true;
  const FIXED_TURN_ANGLES = [45, -45, 90, -90];

  let canvasEl;
  let ready = $state(false);
  let frameID = 0;
  let observer;

  // global params
  let width        = $state(0.05);
  let inkFlow      = $state(0.25);

  // variable tail width (ported from the ink playground). smoothstep "step":
  // tail width = widthEnd fraction of head width; offset = where the width drops
  // (0 head/tip .. 1 tail), range = how soft the drop is (small = abrupt, large = gradual).
  let widthPreset  = $state('linear');
  let widthEnd     = $state(0.0);
  let widthOffset  = $state(0.5);
  let widthRange   = $state(1.0);

  const widthPresets = {
    uniform:    { end: 1.0,  offset: 0.5,  range: 1.0 },  // no extra taper
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

  let segmentCount = $state(12);
  let spiritLen     = $state(0.2);
  let propSpeed    = $state(0.4);
  let maxBendDeg   = $state(60);
  let baseSpeed     = $state(1.0);  // world units per second (constant, path-length normalized)
  let curvature    = $state(0.5);
  let maxSpirits    = $state(12);
  let showPaths    = $state(true);
  let autoSpawn    = $state(true);
  let spawnEverySec= $state(2.0);

  // particle-like lifetime params
  let lifetimeSec  = $state(6.0);
  let opacityStart = $state(1.0);
  let opacityEnd   = $state(0.0);
  let speedStart   = $state(1.0);  // multiplier on baseSpeed at age=0
  let speedEnd     = $state(1.0);  // multiplier at age=lifetime
  let targetDist   = $state(0.6);   // constant world distance from joint to next target
  let targetConeDeg= $state(45);    // half-angle of forward cone for target picking
  let ctrlAlphaDeg = $state(150);   // min angle at tip between (tip->prev_c2) and (tip->new_c1)
  let handleScale  = $state(0.4);   // |c1-p0| = |c2-p1| = handleScale * targetDist (bound length variance)
  let centerBias   = $state(0.6);   // 0..1, how strongly distant spirits steer back to center
  let style        = $state("waterdrop"); // "waterdrop" | "brush"

  $effect(() => { if (ready) setStyle(style); });

  let canvasSize = $state({ w: 1, h: 1 });
  let spirits = $state([]); // {segments, path:{p0,c1,c2,p1}, pathT}
  let lastTimeMs = 0;
  let spawnTimer = 0;

  let linkLen = $derived(segmentCount >= 2 ? spiritLen / (segmentCount - 1) : 0);

  function aspect() {
    return canvasSize.h > 0 ? canvasSize.w / canvasSize.h : 1;
  }

  function randomPoint(margin = 0.85) {
    const a = aspect();
    return {
      x: (Math.random() * 2 - 1) * a * margin,
      y: (Math.random() * 2 - 1) * margin,
    };
  }

  // pick next target at fixed distance from tip, within +-targetConeDeg of forward direction.
  // forward = unit vector along tip's current motion (tangent at end of old path).
  // If no forward (first spawn), pick uniform random direction.
  // Rejection sampling inside cone to stay in bounds; never flip to backward.
  // If all tries leave bounds, emit pure-forward sample (may exit canvas; cone respected).
  function pickTarget(forward, tip, dist, maxTries = 16) {
    const a = aspect();
    const xMin = -a * 0.95, xMax = a * 0.95;
    const yMin = -0.95,     yMax = 0.95;
    if (!forward) {
      const theta = Math.random() * Math.PI * 2;
      return { x: tip.x + Math.cos(theta) * dist, y: tip.y + Math.sin(theta) * dist };
    }
    // bias forward toward center for far-from-origin tips
    const r = Math.hypot(tip.x, tip.y);
    const maxR = Math.hypot(a, 1);
    const w = Math.min(1, r / maxR) * centerBias;
    let fx = forward.x, fy = forward.y;
    if (w > 0 && r > 1e-6) {
      const toCx = -tip.x / r, toCy = -tip.y / r;
      const bx = fx * (1 - w) + toCx * w;
      const by = fy * (1 - w) + toCy * w;
      const bl = Math.hypot(bx, by) || 1;
      fx = bx / bl; fy = by / bl;
    }
    if (FIXED_TURN_MODE) {
      // candidates = forward rotated by each fixed angle.
      // bias respected: softmax-weight by alignment with biased forward (fx,fy).
      // temp scales with w → uniform when w=0 (no bias), sharp when w=1.
      const temp = w * 6;
      const cands = FIXED_TURN_ANGLES.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cc = Math.cos(rad), ss = Math.sin(rad);
        const dx = forward.x * cc - forward.y * ss;
        const dy = forward.x * ss + forward.y * cc;
        const align = dx * fx + dy * fy;
        return { dx, dy, weight: Math.exp(align * temp) };
      });
      const sum = cands.reduce((acc, x) => acc + x.weight, 0) || 1;
      let pick = Math.random() * sum;
      let chosen = cands[0];
      for (const c of cands) {
        pick -= c.weight;
        if (pick <= 0) { chosen = c; break; }
      }
      return { x: tip.x + chosen.dx * dist, y: tip.y + chosen.dy * dist };
    }
    const half = (targetConeDeg * Math.PI) / 180;
    for (let i = 0; i < maxTries; i++) {
      const theta = (Math.random() * 2 - 1) * half;
      const c = Math.cos(theta), s = Math.sin(theta);
      const dirX = fx * c - fy * s;
      const dirY = fx * s + fy * c;
      const cx = tip.x + dirX * dist;
      const cy = tip.y + dirY * dist;
      if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) {
        return { x: cx, y: cy };
      }
    }
    // fallback: pure biased forward
    return { x: tip.x + fx * dist, y: tip.y + fy * dist };
  }

  // build cubic bezier p0 -> p1 with bounded handle distances + continuity + C-curve.
  //  - |c1 - p0| = |c2 - p1| = handleLen = handleScale * targetDist (constant).
  //    Fixed handle magnitudes bound bezier arc-length variance -> stable speed.
  //  - If opts.prevC2: c1 direction sampled in cone of half-angle (180-ctrlAlphaDeg) around
  //    forward (=-back from prev_c2). Direction continuity at joint.
  //  - c2 placed on same perpendicular side of chord as c1 (C-curve, not S).
  function makePath(p0, p1, opts = {}) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const chordX = dx / len, chordY = dy / len;
    const handleLen = handleScale * targetDist;

    // --- c1 direction ---
    let c1dx, c1dy;
    if (opts.prevC2) {
      const bx = opts.prevC2.x - p0.x;
      const by = opts.prevC2.y - p0.y;
      const bl = Math.hypot(bx, by) || 1;
      const fwdX = -bx / bl, fwdY = -by / bl;
      const halfCone = ((180 - ctrlAlphaDeg) * Math.PI) / 180;
      const phi = (Math.random() * 2 - 1) * halfCone;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      c1dx = fwdX * cp - fwdY * sp;
      c1dy = fwdX * sp + fwdY * cp;
    } else {
      // first spawn: along chord with perpendicular tilt scaled by curvature
      const tilt = (Math.random() * 2 - 1) * curvature * (Math.PI / 3);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      c1dx = chordX * ct - chordY * st;
      c1dy = chordX * st + chordY * ct;
    }
    const c1 = { x: p0.x + c1dx * handleLen, y: p0.y + c1dy * handleLen };

    // c1 side relative to chord (cross sign)
    const c1Cross = dx * (c1.y - p0.y) - dy * (c1.x - p0.x);
    const sideSign = c1Cross >= 0 ? 1 : -1;

    // --- c2 direction: chord-backward, tilted toward c1's side by 0..curvature*60deg ---
    const tilt2 = Math.random() * curvature * (Math.PI / 3) * sideSign;
    const ct2 = Math.cos(tilt2), st2 = Math.sin(tilt2);
    const backX = -chordX, backY = -chordY;
    const c2dx = backX * ct2 - backY * st2;
    const c2dy = backX * st2 + backY * ct2;
    const c2 = { x: p1.x + c2dx * handleLen, y: p1.y + c2dy * handleLen };

    return { p0, c1, c2, p1 };
  }

  function sampleBezier(path, t) {
    const omt = 1 - t;
    const a = omt * omt * omt;
    const b = 3 * omt * omt * t;
    const c = 3 * omt * t * t;
    const d = t * t * t;
    return {
      x: a * path.p0.x + b * path.c1.x + c * path.c2.x + d * path.p1.x,
      y: a * path.p0.y + b * path.c1.y + c * path.c2.y + d * path.p1.y,
    };
  }

  // approximate arc length of cubic bezier via uniform-t sampling
  function bezierLength(path, samples = 24) {
    let len = 0;
    let prev = sampleBezier(path, 0);
    for (let i = 1; i <= samples; i++) {
      const p = sampleBezier(path, i / samples);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return Math.max(len, 1e-3);
  }

  function spawnSpirit(origin) {
    const start = origin ?? { x: 0, y: 0 };
    const target = pickTarget(null, start, targetDist);
    const path = makePath(start, target); // no prevC2 on first path
    const N = Math.max(2, Math.floor(segmentCount));
    const segments = [];
    for (let i = 0; i < N; i++) segments.push({ x: start.x, y: start.y });
    spirits.push({
      segments,
      path,
      pathT: 0,
      pathLen: bezierLength(path),
      age: 0,
      lifetime: lifetimeSec,
    });
    if (spirits.length > maxSpirits) spirits.shift();
  }

  function stepChainPhysics(points, tipTarget) {
    const N = points.length;
    if (N < 2) return;
    const speed = Math.max(0, Math.min(1, propSpeed));
    points[N - 1] = { x: tipTarget.x, y: tipTarget.y };
    for (let i = N - 2; i >= 0; i--) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const d = Math.hypot(dx, dy);
      if (d > linkLen && d > 1e-6) {
        const pull = (d - linkLen) * speed;
        const inv = pull / d;
        points[i] = { x: points[i].x + dx * inv, y: points[i].y + dy * inv };
      }
    }
    const maxBend = (maxBendDeg * Math.PI) / 180;
    if (maxBend < Math.PI - 1e-3 && N >= 3) {
      const minCosForClamp = -Math.cos(maxBend);
      for (let i = N - 2; i >= 1; i--) {
        const tip = points[i + 1];
        const mid = points[i];
        const head = points[i - 1];
        const ax = tip.x - mid.x, ay = tip.y - mid.y;
        const bx = head.x - mid.x, by = head.y - mid.y;
        const aLen = Math.hypot(ax, ay);
        const bLen = Math.hypot(bx, by);
        if (aLen < 1e-6 || bLen < 1e-6) continue;
        const adx = ax / aLen, ady = ay / aLen;
        const bdx = bx / bLen, bdy = by / bLen;
        const cosAng = adx * bdx + ady * bdy;
        if (cosAng > minCosForClamp) {
          const curAng = Math.atan2(adx * bdy - ady * bdx, adx * bdx + ady * bdy);
          const side = curAng >= 0 ? 1 : -1;
          const targetAng = (Math.PI - maxBend) * side;
          const newAng = curAng + (targetAng - curAng) * speed;
          const c = Math.cos(newAng), s = Math.sin(newAng);
          const newBdx = adx * c - ady * s;
          const newBdy = adx * s + ady * c;
          points[i - 1] = { x: mid.x + newBdx * bLen, y: mid.y + newBdy * bLen };
        }
      }
      for (let i = N - 2; i >= 0; i--) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const d = Math.hypot(dx, dy);
        if (d > linkLen && d > 1e-6) {
          const pull = (d - linkLen) * speed;
          const inv = pull / d;
          points[i] = { x: points[i].x + dx * inv, y: points[i].y + dy * inv };
        }
      }
    }
  }

  function step(dt) {
    if (autoSpawn) {
      spawnTimer += dt;
      if (spawnTimer >= spawnEverySec) {
        spawnTimer = 0;
        spawnSpirit();
      }
    }
    for (const c of spirits) {
      c.age += dt;
      const t01 = c.lifetime > 0 ? Math.min(1, c.age / c.lifetime) : 1;
      const speedMul = speedStart + (speedEnd - speedStart) * t01;
      // normalize by path length so tip moves at constant world-space speed
      const dPathT = (baseSpeed * speedMul * dt) / c.pathLen;
      c.pathT = Math.min(1, c.pathT + dPathT);
      const tip = sampleBezier(c.path, c.pathT);
      stepChainPhysics(c.segments, tip);
      if (c.pathT >= 1) {
        const newOrigin = c.path.p1;
        const prevC2 = c.path.c2;
        // forward at tip = tangent direction at end of old bezier = normalize(p1 - c2)
        const fx = newOrigin.x - prevC2.x;
        const fy = newOrigin.y - prevC2.y;
        const fl = Math.hypot(fx, fy) || 1;
        const forward = { x: fx / fl, y: fy / fl };
        const newTarget = pickTarget(forward, newOrigin, targetDist);
        c.path = makePath(newOrigin, newTarget, { prevC2 });
        c.pathT = 0;
        c.pathLen = bezierLength(c.path);
      }
    }
    // cull dead
    for (let i = spirits.length - 1; i >= 0; i--) {
      if (spirits[i].age >= spirits[i].lifetime) spirits.splice(i, 1);
    }
    spirits = spirits;
  }

  function pushToScene() {
    const payload = spirits.map((c) => {
      const t01 = c.lifetime > 0 ? Math.min(1, c.age / c.lifetime) : 1;
      const opacity = opacityStart + (opacityEnd - opacityStart) * t01;
      return {
        points: c.segments,
        width,
        inkFlow,
        offset: 0,
        arcLength: 1,
        opacity,
        widthEnd,
        widthOffset,
        widthRange,
      };
    });
    updateSpirits(payload);
  }

  function loop(tMs) {
    frameID = requestAnimationFrame(loop);
    const dt = lastTimeMs ? Math.min(0.05, (tMs - lastTimeMs) / 1000) : 0;
    lastTimeMs = tMs;
    step(dt);
    pushToScene();
    render();
  }

  function onResize() {
    if (!canvasEl) return;
    const w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    resize(w, h);
    canvasSize = { w, h };
  }

  function onPointerDown(e) {
    const r = canvasEl.getBoundingClientRect();
    const p = screenToWorld(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    spawnSpirit(p);
  }

  function clearAll() {
    spirits = [];
  }

  function worldToScreen(p) {
    const { w, h } = canvasSize;
    const a = w / h;
    const u = (p.x / a + 1) * 0.5;
    const v = (p.y + 1) * 0.5;
    return { x: u * w, y: (1 - v) * h };
  }

  function pathSvgD(path) {
    const a = worldToScreen(path.p0);
    const b = worldToScreen(path.c1);
    const c = worldToScreen(path.c2);
    const d = worldToScreen(path.p1);
    return `M ${a.x} ${a.y} C ${b.x} ${b.y}, ${c.x} ${c.y}, ${d.x} ${d.y}`;
  }

  onMount(() => {
    init(canvasEl);
    ready = true;
    onResize();
    spawnSpirit();
    window.addEventListener("resize", onResize);
    observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        lastTimeMs = 0;
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

<div class="brush-demo">
  <div class="stage">
    <canvas
      bind:this={canvasEl}
      onpointerdown={onPointerDown}
    ></canvas>
    {#if showPaths && spirits.length > 0}
      <svg
        class="overlay"
        viewBox={`0 0 ${canvasSize.w} ${canvasSize.h}`}
        preserveAspectRatio="none"
      >
        {#each spirits as c}
          <path d={pathSvgD(c.path)} class="bezier" />
          {@const s0 = worldToScreen(c.path.p0)}
          {@const s1 = worldToScreen(c.path.p1)}
          {@const tip = worldToScreen(sampleBezier(c.path, c.pathT))}
          <circle cx={s0.x} cy={s0.y} r="3" class="origin" />
          <circle cx={s1.x} cy={s1.y} r="3" class="target" />
          <circle cx={tip.x} cy={tip.y} r="4" class="tip" />
        {/each}
      </svg>
    {/if}
  </div>

  <div class="controls">
    <div class="buttons">
      <button type="button" onclick={() => spawnSpirit()}>spawn</button>
      <button type="button" onclick={clearAll}>clear</button>
      <span class="hint">click canvas to spawn at point {spirits.length}/{maxSpirits}</span>
    </div>
    <div class="square" role="group">
        <label><input type="radio" name="style" value="waterdrop" bind:group={style} /> waterdrop</label>
        <label><input type="radio" name="style" value="brush"     bind:group={style} /> brush</label>
    </div>
    <fieldset><legend>Field</legend>
    <label class="check">
      <input type="checkbox" bind:checked={autoSpawn} />
      <span>auto spawn</span>
    </label>
    <label>
      <span>max spirits</span>
      <input type="range" min="1" max="32" step="1" bind:value={maxSpirits} />
      <output>{maxSpirits}</output>
    </label>
    <label>
      <span>speed</span>
      <input type="range" min="0.1" max="6" step="0.01" bind:value={baseSpeed} />
      <output>{baseSpeed.toFixed(2)}</output>
    </label>
    <label>
      <span>curvature</span>
      <input type="range" min="0" max="1.5" step="0.01" bind:value={curvature} />
      <output>{curvature.toFixed(2)}</output>
    </label>
    <label>
      <span>target dist</span>
      <input type="range" min="0.1" max="2" step="0.01" bind:value={targetDist} />
      <output>{targetDist.toFixed(2)}</output>
    </label>
    <label>
      <span>target cone</span>
      <input type="range" min="0" max="90" step="1" bind:value={targetConeDeg} />
      <output>{targetConeDeg}&deg;</output>
    </label>
    <label>
      <span>ctrl alpha</span>
      <input type="range" min="90" max="180" step="1" bind:value={ctrlAlphaDeg} />
      <output>{ctrlAlphaDeg}&deg;</output>
    </label>
    <label>
      <span>handle len</span>
      <input type="range" min="0.1" max="0.8" step="0.01" bind:value={handleScale} />
      <output>{handleScale.toFixed(2)}</output>
    </label>
    <label>
      <span>center bias</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={centerBias} />
      <output>{centerBias.toFixed(2)}</output>
    </label>
    <hr />
    <label class="check">
      <input type="checkbox" bind:checked={showPaths} />
      <span>show bezier paths</span>
    </label>
    </fieldset>
    <fieldset><legend>Spirit</legend>
    <label>
      <span>lifetime</span>
      <input type="range" min="0.5" max="30" step="0.1" bind:value={lifetimeSec} />
      <output>{lifetimeSec.toFixed(1)}s</output>
    </label>
    <label>
      <span>opacity 0&rarr;1</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={opacityStart} />
      <output>{opacityStart.toFixed(2)}</output>
    </label>
    <label>
      <span>opacity end</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={opacityEnd} />
      <output>{opacityEnd.toFixed(2)}</output>
    </label>
    <label>
      <span>speed mult 0</span>
      <input type="range" min="0" max="3" step="0.01" bind:value={speedStart} />
      <output>{speedStart.toFixed(2)}</output>
    </label>
    <label>
      <span>speed mult 1</span>
      <input type="range" min="0" max="3" step="0.01" bind:value={speedEnd} />
      <output>{speedEnd.toFixed(2)}</output>
    </label>
    <hr />
    <label>
      <span>segments</span>
      <input type="range" min="2" max="40" step="1" bind:value={segmentCount} />
      <output>{segmentCount}</output>
    </label>
    <label>
      <span>spirit length</span>
      <input type="range" min="0.1" max="2.5" step="0.01" bind:value={spiritLen} />
      <output>{spiritLen.toFixed(2)}</output>
    </label>
    <label>
      <span>prop. speed</span>
      <input type="range" min="0.01" max="1" step="0.01" bind:value={propSpeed} />
      <output>{propSpeed.toFixed(2)}</output>
    </label>
    <label>
      <span>max bend</span>
      <input type="range" min="0" max="180" step="1" bind:value={maxBendDeg} />
      <output>{maxBendDeg}&deg;</output>
    </label>
    <hr />
    <label>
      <span>width</span>
      <input type="range" min="0.01" max="0.4" step="0.001" bind:value={width} />
      <output>{width.toFixed(3)}</output>
    </label>
    <label>
      <span>width shape</span>
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
      <span>tail width</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthEnd}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthEnd.toFixed(2)}</output>
    </label>
    <label>
      <span>step offset</span>
      <input
        type="range" min="0" max="1" step="0.01"
        bind:value={widthOffset}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthOffset.toFixed(2)}</output>
    </label>
    <label>
      <span>step range</span>
      <input
        type="range" min="0" max="1.5" step="0.01"
        bind:value={widthRange}
        oninput={() => (widthPreset = "custom")}
      />
      <output>{widthRange.toFixed(2)}</output>
    </label>
    <label>
      <span>ink flow</span>
      <input type="range" min="0" max="1" step="0.001" bind:value={inkFlow} />
      <output>{inkFlow.toFixed(2)}</output>
    </label>
    </fieldset>
  </div>
</div>

<style>
  .brush-demo {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media(min-width: 768px) {
    .brush-demo {
      flex-direction: row;
    }
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
  }
  canvas {
    width: 100%;
    height: 100%;
    background: #fffce0;
    border-radius: 0.25rem;
    touch-action: none;
    cursor: crosshair;
    display: block;
  }
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }
  .overlay .bezier {
    fill: none;
    stroke: rgba(60, 120, 200, 0.4);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .overlay circle.origin { fill: rgba(50, 180, 80, 0.9); }
  .overlay circle.target { fill: rgba(220, 80, 80, 0.9); }
  .overlay circle.tip    { fill: rgba(50, 100, 220, 0.95); stroke: white; stroke-width: 1.5; }
  .controls {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  hr {
    border: 0;
    border-top: 1px solid rgba(128,128,128,0.3);
    margin: 0.25rem 0;
  }
  label {
    display: grid;
    grid-template-columns: 6rem 1fr 3rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }
  label.check { grid-template-columns: auto 1fr; }
  input[type="range"] { width: 100%; }
  .buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  button {
    padding: 0.3rem 0.8rem;
    font-size: 0.9rem;
  }
  .hint {
    font-size: 0.8rem;
    opacity: 0.7;
  }
</style>
