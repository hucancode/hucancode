<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/paint.svelte";
  import RoughTimeline from "$lib/components/rough-timeline.svelte";
  import { TIMELINE_END } from "$lib/scenes/paint.js";

  const Github = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/></svg>`;
  const Download = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M4 22v-2h16v2zm8-4L5 9h4V2h6v7h4z"/></svg>`;
  const Book = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M2 21V3l1.675 1.675L5.325 3L7 4.675L8.675 3l1.65 1.675L12 3l1.675 1.675L15.325 3L17 4.675L18.675 3l1.65 1.675L22 3v18zm2-2h7v-6H4zm9 0h7v-2h-7zm0-4h7v-2h-7zm-9-4h16V8H4z"/></svg>`;

  // scroll length (px) mapped onto the whole timeline. The stage is sticky and
  // fills the viewport; this tall track gives the page something to scroll.
  const SCROLL_LEN = 3200;

  let t = $state(0);
  let playing = $state(false);
  let userPaused = $state(false); // explicit pause -> don't auto-resume at the footer
  let showDebug = $state(false); // ?debug=true -> reveal debug widgets
  let debug = $state(false); // scene path overlay toggle
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
</svelte:head>
<svelte:window onscroll={onScroll} onresize={placeHints} />

<header class="topbar">
  <div class="bar">
    <nav class="links" bind:this={linksEl}>
      <a href="https://github.com/hucancode" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">{@html Github}</a>
      <a href="/resume.pdf" download aria-label="Resume" title="Resume">{@html Download}</a>
      <a href="/cp" aria-label="Notes" title="Notes">{@html Book}</a>
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

    <div class="controls" bind:this={controlsEl}>
      <button class="play" onclick={togglePlay} aria-label={playing ? "pause" : "play"}>
        {playing ? "⏸" : "▶"}
      </button>
      <RoughTimeline {progress} onseek={seek} />
      {#if showDebug}
        <div class="debug">
          <input type="range" min="0" max={TIMELINE_END} step="0.01" value={t} oninput={(e) => seek(+e.target.value / TIMELINE_END)} />
          <span>{t.toFixed(2)}s</span>
          <label><input type="checkbox" bind:checked={debug} /> path</label>
        </div>
      {/if}
    </div>
  </div>
</header>

<div class="track" style:height={`calc(100vh + ${SCROLL_LEN}px)`}>
  <div class="stage">
    <Scene fill bind:t bind:playing {debug} />
  </div>
</div>

<button class="scroll-hint" class:show={progress < 0.02} onclick={() => (playing = true)} aria-label="play">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m6 9l6 6l6-6"/></svg>
</button>

<footer class="footer" class:show={progress >= 1}>
  <a href="/playgrounds">More like this →</a>
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
    width: 2rem;
    height: 2rem;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1rem;
    color: #3a3320;
    opacity: 0.7;
  }
  .play:hover { opacity: 1; }
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
  .footer {
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
  .footer.show {
    opacity: 1;
  }
  .footer a {
    pointer-events: auto;
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
  .footer a {
    color: #6b4e71;
    text-decoration: none;
    font-size: 1.1rem;
  }
  .footer a:hover { text-decoration: underline; }
</style>
