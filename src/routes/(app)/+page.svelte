<script>
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import rough from "roughjs";
  import Scene from "$lib/components/paint.svelte";
  import Timeline from "$lib/components/timeline.svelte";
  import { TIMELINE_END } from "$lib/scenes/paint.js";
  import Github from "$icons/simple-icons/github.svg?raw";
  import Download from "$icons/google-material/download.svg?raw";
  import Book from "$icons/google-material/book.svg?raw";
  import Play from "$icons/google-material/play-arrow.svg?raw";
  import Pause from "$icons/google-material/pause.svg?raw";
  import ChevronDown from "$icons/google-material/chevron-down.svg?raw";

  // scroll length (px) mapped onto the whole timeline. The stage is sticky and
  // fills the viewport; this tall track gives the page something to scroll.
  const SCROLL_LEN = 3200;

  let t = $state(0);
  let playing = $state(false);
  let userPaused = $state(false); // explicit pause -> don't auto-resume at the footer
  let showDebug = $state(false); // ?debug=true -> reveal debug widgets
  let debugPath2d = $state(false);
  let debugPath3d = $state(false);
  const debug = $derived({ path2d: debugPath2d, path3d: debugPath3d });
  let lastSyncY = -1; // last scroll position WE set; onScroll ignores a match
  const SYNC_TOL = 3; // px slack (browser rounds/clamps scrollTo)
  // one fixed-size coach mark per icon -> never scales with the row width
  // lx/ly stagger each label off the row; arrow tip stays at the icon (42,6)
  const ICON_HINTS = [
    { label: "Code", rot: -6, bend: -6, lx: 38, ly: 30 },
    { label: "Resume", rot: 5, bend: 8, lx: 47, ly: 52 },
    { label: "Notes", rot: -8, bend: -3, lx: 45, ly: 38 },
  ];
  let linksEl = $state(null); // icon row; we measure each child <a>
  let iconHintEls = $state([]); // one popover per icon
  let hints2El = $state(null); // seek-bar coach-mark popover
  let controlsEl = $state(null); // play + seek bar it points at

  const progress = $derived(Math.min(1, t / TIMELINE_END));

  // rough SVG underline for the footer link
  let footerLinkEl = $state(null);
  let roughSvgEl = $state(null);
  let _roughPaths = [];
  let _underlineShown = false;

  function drawRoughUnderline(seed) {
    if (!roughSvgEl || !footerLinkEl) return [];
    while (roughSvgEl.firstChild) roughSvgEl.removeChild(roughSvgEl.firstChild);
    const w = footerLinkEl.offsetWidth;
    if (!w) return [];
    roughSvgEl.setAttribute("width", w);
    const rc = rough.svg(roughSvgEl);
    const g = rc.line(1, 3, w - 1, 3, {
      roughness: 1.8,
      stroke: "currentColor",
      strokeWidth: 1.8,
      disableMultiStroke: false,
      seed: seed ?? 42,
    });
    roughSvgEl.appendChild(g);
    const paths = [...roughSvgEl.querySelectorAll("path")];
    paths.forEach(p => {
      const len = p.getTotalLength();
      p.setAttribute("stroke-dasharray", len);
      p.setAttribute("stroke-dashoffset", len);
    });
    return paths;
  }

  function animateUnderlineIn(paths, delay = 0) {
    paths.forEach((p, i) => {
      p.style.transition = `stroke-dashoffset 0.55s ease ${delay + i * 70}ms`;
      p.style.strokeDashoffset = "0";
    });
  }

  function animateUnderlineOut(paths) {
    paths.forEach(p => {
      const len = p.getTotalLength();
      p.style.transition = "stroke-dashoffset 0.35s ease";
      p.style.strokeDashoffset = String(len);
    });
  }

  $effect(() => {
    if (!browser || _underlineShown || progress < 1) return;
    _underlineShown = true;
    _roughPaths = drawRoughUnderline(42);
    animateUnderlineIn(_roughPaths, 200);
  });

  function onFooterHover() {
    _roughPaths = drawRoughUnderline(Math.random() * 9999 | 0);
    animateUnderlineIn(_roughPaths);
  }
  function onFooterLeave() {
    animateUnderlineOut(_roughPaths);
  }

  onMount(() => {
    _roughPaths = drawRoughUnderline(42);
  });

  function scrollTo(px) {
    lastSyncY = Math.round(px);
    window.scrollTo(0, lastSyncY);
  }

  // User scroll. OUR own programmatic scroll (matches lastSyncY) is ignored --
  // a position match is robust against the scroll event firing a frame late.
  // Grabbing the scrollbar mid-track stops autoplay and scrubs; scrolling all
  // the way to the footer resumes playback (unless the user explicitly paused).
  function onScroll() {
    if (!browser) return;
    if (Math.abs(window.scrollY - lastSyncY) <= SYNC_TOL) return; // our own move
    const raw = window.scrollY / SCROLL_LEN;
    if (raw >= 1) {
      if (!userPaused) playing = true; // reached the footer -> keep flying
    } else {
      playing = false; // grabbed the scrollbar -> stop autoplay, scrub
      t = raw * TIMELINE_END;
    }
  }

  // While playing, follow the clock with the scrollbar -- but once the timeline
  // is done (at the footer) leave the user where they are and just let it loop.
  $effect(() => {
    if (!browser || !playing || progress >= 1) return;
    scrollTo(progress * SCROLL_LEN);
  });

  // pin the popover's top-left to the icon row (top layer -> position by JS,
  // don't rely on CSS anchor positioning which not every browser ships).
  // center a fixed-width popover under a target element
  function placeUnder(el, target, w) {
    if (!el || !target) return;
    const r = target.getBoundingClientRect();
    el.style.left = `${r.left + r.width / 2 - w / 2}px`;
    el.style.top = `${r.bottom}px`;
    el.style.width = `${w}px`;
  }

  function placeHints() {
    const icons = linksEl?.children ?? [];
    iconHintEls.forEach((el, i) => placeUnder(el, icons[i], 84));
    placeUnder(hints2El, controlsEl, 120);
  }

  function toggleHint(el, want) {
    if (!el) return;
    const open = el.matches?.(":popover-open");
    if (want && !open) el.showPopover?.();
    else if (!want && open) el.hidePopover?.();
  }

  // show coach marks only in the empty state (top of the timeline)
  $effect(() => {
    if (!browser) return;
    const want = progress < 0.02;
    iconHintEls.forEach((el) => toggleHint(el, want));
    toggleHint(hints2El, want);
    if (want) placeHints();
  });

  function seek(p) {
    playing = false;
    userPaused = false; // scrubbing the bar is not an explicit pause
    t = p * TIMELINE_END;
    if (browser) scrollTo(p * SCROLL_LEN);
  }
  function togglePlay() {
    if (t >= TIMELINE_END) t = 0; // replay from the top
    playing = !playing;
    userPaused = !playing;
  }

  if (browser) {
    const qs = new URLSearchParams(location.search);
    if (qs.get("debug") === "true" || qs.get("debug") === "1") showDebug = true;
  }
</script>

<svelte:head>
  <title>hucancode</title>
  <!-- start the dragon mesh download during HTML parse; renderer fetch hits cache -->
  <link rel="preload" href="/assets/obj/dragon-low.obj" as="fetch" />
</svelte:head>
<svelte:window onscroll={onScroll} onresize={placeHints} />

<header class="topbar">
  <div class="bar">
    <nav class="links" bind:this={linksEl}>
      <a href="https://github.com/hucancode" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">{@html Github}</a>
      <a href="/resume.pdf" download aria-label="Resume" title="Resume">{@html Download}</a>
      <a href="/cp" aria-label="Notes" title="Notes">{@html Book}</a>
      <div class="controls" bind:this={controlsEl}>
        <button class="play" onclick={togglePlay} aria-label={playing ? "pause" : "play"}>
          {@html playing ? Pause : Play}
        </button>
        <Timeline {progress} onseek={seek} />
        {#if showDebug}
          <div class="debug">
            <label><input type="checkbox" bind:checked={debugPath2d} /> path 2d</label>
            <label><input type="checkbox" bind:checked={debugPath3d} /> path 3d</label>
          </div>
        {/if}
      </div>
    </nav>

    <!-- empty-state coach marks: one fixed-size popover per icon (top layer),
         each centered under its own icon so it never drifts or scales. -->
    {#each ICON_HINTS as h, i}
      <div class="hints" popover="manual" bind:this={iconHintEls[i]} aria-hidden="true">
        <svg viewBox="0 0 84 60">
          <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d={`M${h.lx} ${h.ly - 11} C ${h.lx + h.bend} ${h.ly - 20} ${42 - h.bend} 14 42 6`} />
            <path d="M42 6 l -4 4 M42 6 l 4 4.5" />
          </g>
          <text class="ink" x={h.lx} y={h.ly} text-anchor="middle" transform={`rotate(${h.rot} ${h.lx} ${h.ly})`}>{h.label}</text>
        </svg>
      </div>
    {/each}

    <!-- coach mark for the seek bar -->
    <div class="hints" popover="manual" bind:this={hints2El} aria-hidden="true">
      <svg viewBox="0 0 120 60">
        <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M58 40 C 54 26, 66 16, 60 7.5" />
          <path d="M60 7.5 l -6 5 M60 7.5 l 5 6.5" />
        </g>
        <text class="ink" x="60" y="44" text-anchor="middle" transform="rotate(-4 60 44)">Animation!</text>
      </svg>
    </div>


  </div>
</header>

<div class="track" style:height={`calc(100vh + ${SCROLL_LEN}px)`}>
  <div class="stage">
    <Scene fill bind:t bind:playing {debug} />
  </div>
</div>

<button class="scroll-hint" class:show={progress < 0.02} onclick={() => (playing = true)} aria-label="play">
  {@html ChevronDown}
</button>

<footer class:show={progress >= 1}>
  <span class="rough-link" bind:this={footerLinkEl}
        onmouseenter={onFooterHover} onmouseleave={onFooterLeave}>
    <a href="/playgrounds">More like this...</a>
    <svg class="rough-under" bind:this={roughSvgEl} height="8" aria-hidden="true"></svg>
  </span>
</footer>

<style>
  @font-face {
    font-family: "Virgil";
    src: url("/fonts/Virgil.woff2") format("woff2");
    font-display: swap;
  }
  :global(body:has(.stage)) {
    background: rgb(255, 252, 224);
  }
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding: 0.4rem 0.9rem;
    background: linear-gradient(180deg, rgba(255, 252, 224, 0.92), rgba(255, 252, 224, 0));
    backdrop-filter: blur(2px);
  }
  .bar {
    position: relative;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .hints {
    margin: 0;
    border: none;
    background: none;
    padding: 0;
    inset: auto; /* reset UA popover centering; JS sets left/top/width */
    position: fixed;
    overflow: visible; /* let rotated labels spill past the row width */
    color: #3a3320;
    pointer-events: none; /* never block icon clicks / canvas drags */
    opacity: 0;
    transition:
      opacity 0.4s ease,
      overlay 0.4s allow-discrete,
      display 0.4s allow-discrete;
  }
  .hints:popover-open {
    opacity: 0.75;
  }
  @starting-style {
    .hints:popover-open {
      opacity: 0;
    }
  }
  .hints svg {
    display: block;
    width: 100%;
    height: auto;
  }
  .hints text {
    font-family: "Virgil", "Comic Sans MS", cursive;
    font-size: 17px;
    fill: currentColor;
  }
  .links {
    flex: none; /* cluster tight on the left, don't stretch */
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 1.6rem; /* room for the coach-mark labels under each icon */
  }
  .links a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    height: 2.2rem;
    color: #3a3320;
  }
  .controls {
    flex: 1 1 auto; /* fill all space left of the icons -> long seek bar */
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .links :global(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  .play {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    background: none;
    cursor: pointer;
    color: #3a3320;
    opacity: 0.7;
  }
  .play:hover { opacity: 1; }
  .play :global(svg) {
    width: 1.4rem;
    height: 1.4rem;
  }
  .debug {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    opacity: 0.7;
  }
  .track {
    position: relative;
  }
  .stage {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100%;
  }
  footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    text-align: center;
    padding: 1.5rem;
    pointer-events: none; /* let drags reach the canvas; re-enable on the link */
    background: linear-gradient(0deg, rgba(255, 252, 224, 0.85), rgba(255, 252, 224, 0));
    opacity: 0; /* only visible once scrolled to the bottom */
    transition: opacity 0.4s ease;
  }
  footer.show {
    opacity: 1;
  }
  .rough-link {
    pointer-events: auto;
    position: relative;
    display: inline-block;
  }
  footer a {
    font-family: 'Virgil';
    text-decoration: none;
  }
  .rough-under {
    position: absolute;
    bottom: -2px;
    left: 0;
    pointer-events: none;
    overflow: visible;
  }
  .scroll-hint {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    color: #3a3320;
    border: none;
    background: none;
    padding: 0.5rem;
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
    transition: opacity 0.4s ease;
  }
  .scroll-hint.show {
    opacity: 0.6;
    pointer-events: auto;
    animation: hint-bounce 1.4s ease-in-out infinite;
  }
  .scroll-hint.show:hover {
    opacity: 1;
  }
  .scroll-hint svg {
    width: 2.5rem;
    height: 2.5rem;
  }
  @keyframes hint-bounce {
    0%, 100% { transform: translate(-50%, -50%); }
    50% { transform: translate(-50%, calc(-50% + 10px)); }
  }
  @media (prefers-reduced-motion: reduce) {
    .scroll-hint.show { animation: none; }
  }
  footer a {
    color: #6b4e71;
    text-decoration: none;
    font-size: 1.1rem;
  }
</style>
