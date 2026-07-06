<script>
  import { browser } from "$app/environment";
  import Scene from "$lib/components/paint.svelte";
  import Timeline from "$lib/components/timeline.svelte";
  import RoughIcon from "$lib/components/rough-icon.svelte";
  import { TIMELINE_END } from "$lib/playgrounds/main";
  import { D3_STYLE } from "$lib/playgrounds/main/config.js";
  import Github from "$icons/simple-icons/github.svg?raw";
  import Profile from "$icons/google-material/profile.svg?raw";
  import PersonRaiseHand from "$icons/google-material/person-raise-hand.svg?raw";
  import Play from "$icons/google-material/play-arrow.svg?raw";
  import Pause from "$icons/google-material/pause.svg?raw";
  import Restart from "$icons/google-material/restart.svg?raw";
  import ChevronDown from "$icons/google-material/chevron-down.svg?raw";
  import { onMount } from "svelte";
  import { stamp } from "$lib/engine/profile.js";
  import { trackMilestone } from "$lib/ga.js";

  stamp("+page.svelte script init (hydration)");
  onMount(() => stamp("+page.svelte onMount (DOM ready)"));

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
  let selfScroll = false; // true while our programmatic scroll's event is pending
  let lastTarget = -1; // last y we programmatically scrolled to
  const SYNC_TOL = 3; // px slack: skip scrollTo if already within this of target
  // px window around the clock's position that still counts as "our own move".
  // Safari fires stray settle events after the one selfScroll swallows; they
  // land on lastTarget, so anything still parked there is autoplay, not a grab.
  const SCRUB_TOL = 80;
  // one fixed-size coach mark per icon -> never scales with the row width
  // lx/ly stagger each label off the row; arrow tip stays at the icon (42,6)
  const ICON_HINTS = [
    { label: "Code", rot: 6, bend: -6, lx: 38, ly: 40 },
    { label: "Resume", rot: 0, bend: 2, lx: 47, ly: 52 },
    { label: "Notes", rot: -8, bend: -3, lx: 55, ly: 44 },
  ];
  let linksEl = $state(null); // icon row; we measure each child <a>
  let iconHintEls = $state([]); // one popover per icon
  let hints2El = $state(null); // seek-bar coach-mark popover
  let controlsEl = $state(null); // play + seek bar it points at

  const progress = $derived(Math.min(1, t / TIMELINE_END));
  const atEnd = $derived(t >= TIMELINE_END);

  $effect(() => trackMilestone(progress));

  function scrollTo(px) {
    const y = Math.round(px);
    lastTarget = y;
    if (Math.abs(window.scrollY - y) <= SYNC_TOL) return; // already there, no event
    selfScroll = true; // swallow the one scroll event this triggers
    window.scrollTo(0, y);
  }

  // It's HARD to make scroll automatic but not invasive. Current attempt:
  // - Programmatic scroll sets selfScroll, so the resulting event is swallowed
  // - Grabbing the scrollbar mid-track and drag it far enough stops autoplay
  // - Scrolling all the way to the footer resumes playback unless the user explicitly paused
  function onScroll() {
    if (!browser) return;
    if (selfScroll) {
      selfScroll = false;
      return;
    } // our own move
    const y = window.scrollY;
    const raw = y / SCROLL_LEN;
    if (raw >= 1) {
      if (!userPaused) playing = true; // reached the footer -> keep flying
      return;
    }
    // Safari fires extra settle events past the one selfScroll swallowed; those
    // are still parked on the clock's target, so don't mistake them for a grab.
    if (playing && lastTarget >= 0 && Math.abs(y - lastTarget) <= SCRUB_TOL) return;
    playing = false; // grabbed the scrollbar -> stop autoplay, scrub
    t = raw * TIMELINE_END;
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
    if (atEnd) {
      // restart: jump to the top and replay
      t = 0;
      if (browser) scrollTo(0);
      playing = true;
      userPaused = false;
      return;
    }
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
  {#if D3_STYLE === "obj"}
    <link rel="preload" href="/assets/obj/dragon-low.obj" as="fetch" crossorigin />
  {/if}
</svelte:head>
<svelte:window onscroll={onScroll} onresize={placeHints} />

<nav bind:this={linksEl}>
  <a
    href="https://github.com/hucancode"
    target="_blank"
    rel="noreferrer"
    aria-label="GitHub"><RoughIcon svg={Github} /></a
  >
  <a href="/resume.pdf" download aria-label="Resume"
    ><RoughIcon svg={Profile} /></a
  >
  <a href="/notes" aria-label="Notes"><RoughIcon svg={PersonRaiseHand} /></a>
  <div bind:this={controlsEl}>
    <button
      onclick={togglePlay}
      aria-label={atEnd ? "restart" : playing ? "pause" : "play"}
    >
      <RoughIcon svg={atEnd ? Restart : playing ? Pause : Play} />
    </button>
    <Timeline {progress} onseek={seek} />
    {#if showDebug}
      <label><input type="checkbox" bind:checked={debugPath2d} /> path 2d</label>
      <label><input type="checkbox" bind:checked={debugPath3d} /> path 3d</label>
    {/if}
  </div>

  <!-- empty-state coach marks: one fixed-size popover per icon (top layer),
       each centered under its own icon so it never drifts or scales. -->
  {#each ICON_HINTS as h, i}
    <div
      popover="manual"
      bind:this={iconHintEls[i]}
      aria-hidden="true"
    >
      <svg viewBox="0 0 90 60">
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d={`M${h.lx} ${h.ly - 11} C ${h.lx + h.bend} ${h.ly - 20} ${36 - h.bend} 14 42 6`}
          />
          <path d="M42 6 l -4 4 M42 6 l 4 4.5" />
        </g>
        <text
          x={h.lx}
          y={h.ly}
          text-anchor="middle"
          transform={`rotate(${h.rot} ${h.lx} ${h.ly})`}>{h.label}</text
        >
      </svg>
    </div>
  {/each}

  <!-- coach mark for the seek bar -->
  <div popover="manual" bind:this={hints2El} aria-hidden="true">
    <svg viewBox="0 0 120 60">
      <g
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M58 40 C 54 26, 66 16, 60 7.5" />
        <path d="M60 7.5 l -6 5 M60 7.5 l 5 6.5" />
      </g>
      <text
        x="60"
        y="54"
        text-anchor="middle"
        transform="rotate(-4 60 44)">Animation!</text
      >
    </svg>
  </div>
</nav>

<main style:height={`calc(100vh + ${SCROLL_LEN}px)`}>
  <div>
    <Scene bind:t bind:playing {debug} />
  </div>
</main>

<button
  inert={progress >= 0.02}
  onclick={() => (playing = true)}
  aria-label="play"
>
  {@html ChevronDown}
</button>

<footer inert={progress < 1}>
  <a href="/playgrounds">More like this...</a>
  <p>All animations and models are procedurally generated</p>
</footer>

<style>
  /* single <nav> top bar: full-width fixed, content clamped to 1100px and
     centered via side padding (overrides the global <nav> max-width/justify). */
  nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    justify-content: flex-start;
    gap: 1.6rem; /* room for the coach-mark labels under each icon */
    max-width: none;
    padding: 0.4rem max(0.9rem, calc((100vw - 1100px) / 2));
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--paper) 92%, transparent),
      transparent
    );
    backdrop-filter: blur(2px);
  }
  /* coach-mark popovers */
  [popover] {
    margin: 0;
    border: none;
    background: none;
    padding: 0;
    inset: auto; /* reset UA popover centering; JS sets left/top/width */
    position: fixed;
    overflow: visible; /* let rotated labels spill past the row width */
    color: var(--ink);
    pointer-events: none; /* never block icon clicks / canvas drags */
    opacity: 0;
    transition:
      opacity 0.4s ease,
      overlay 0.4s allow-discrete,
      display 0.4s allow-discrete;
  }
  [popover]:popover-open {
    opacity: 0.95;
  }
  @starting-style {
    [popover]:popover-open {
      opacity: 0;
    }
  }
  [popover] svg {
    display: block;
    width: 100%;
    height: auto;
  }
  [popover] text {
    font-family: "Virgil", cursive;
    font-size: 17px;
    fill: currentColor;
  }
  nav > a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    height: 2.2rem;
    color: var(--ink);
  }
  nav > a :global(svg) {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  /* playback controls: fill all space left of the icons -> long seek bar */
  nav > div:not([popover]) {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  nav button {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--ink);
    opacity: 0.9;
  }
  nav button:hover {
    opacity: 1;
  }
  nav button :global(svg) {
    width: 2.2rem;
    height: 2.2rem;
  }
  /* ?debug=true toggles */
  nav label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-variant-numeric: tabular-nums;
    font-size: 0.8rem;
    opacity: 0.85;
  }
  /* tall scroll track; the stage inside stays stuck to the viewport
     (overrides the global <main> width clamp and padding) */
  main {
    max-width: none;
    padding: 0;
  }
  main > div {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100%;
  }
  footer {
    position: fixed;
    bottom: 1rem;
    left: 0;
    right: 0;
    z-index: 10;
    text-align: center;
    padding: 1.5rem;
    pointer-events: none; /* let drags reach the canvas; re-enable on the link */
    background: linear-gradient(
      0deg,
      color-mix(in srgb, var(--paper) 85%, transparent),
      transparent
    );
    opacity: 0; /* only visible once scrolled to the bottom */
    transition: opacity 0.4s ease;
  }
  footer:not([inert]) {
    opacity: 1;
  }
  footer:not([inert]) a {
    pointer-events: auto; /* re-enable clicks once the footer is visible */
  }
  footer a {
    font-family: "Virgil";
    text-decoration: underline wavy;
    text-underline-offset: 0.2em;
    color: var(--link);
    font-size: 1.5rem;
    margin-bottom: 3rem;
  }
  footer p {
    position: absolute;
    right: 0;
    left: 0;
    bottom: 0;
    font-family: "Virgil";
    font-size: 0.85rem;
    color: var(--ink);
    opacity: 0.5;
  }
  /* scroll hint: visible (not inert) only in the empty state */
  main + button {
    position: fixed;
    top: 50%;
    left: 50%;
    scale: 2;
    translate: -50% -50%;
    z-index: 10;
    color: var(--ink);
    border: none;
    background: none;
    padding: 0.5rem;
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.4s ease;
  }
  main + button:not([inert]) {
    opacity: 0.85;
    animation: hint-bounce 1.4s ease-in-out infinite;
  }
  main + button:hover {
    opacity: 1;
  }
  main + button :global(svg) {
    width: 2.5rem;
    height: 2.5rem;
  }
  @keyframes hint-bounce {
    0%,
    100% {
      translate: -50% -50%;
    }
    50% {
      translate: -50% calc(-50% + 10px);
    }
  }
  @media (max-width: 600px) {
    nav {
      gap: 1rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    main + button {
      animation: none;
    }
  }
</style>
