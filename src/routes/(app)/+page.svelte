<script>
  import { browser } from "$app/environment";
  import PlaygroundCanvas from "$lib/components/playground-canvas.svelte";
  import CoachMark from "$lib/components/coach-mark.svelte";
  import Timeline from "$lib/components/timeline.svelte";
  import RoughIcon from "$lib/components/rough-icon.svelte";
  import { TIMELINE_END, createScene } from "$lib/playgrounds/main";
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

  // debug flags, parsed ONCE (the only place that reads the query string):
  //   ?t=<sec>  single paused frame at that scene time
  //   ?play=1   autoplay from the start
  //   ?debug=1  path overlays on + reveal the debug widgets (?debug=true: widgets only)
  //   ?yaw=<rad>          starting orbit yaw
  //   ?backend=webgl|webgpu  force a render backend (default webgpu, falls back to webgl)
  const qs = new URLSearchParams(browser ? location.search : "");
  const qDebug = qs.get("debug");
  const qT = parseFloat(qs.get("t"));
  const qYaw = parseFloat(qs.get("yaw"));

  const showDebug = qDebug === "1" || qDebug === "true";
  let debugPath2d = $state(qDebug === "1");
  let debugPath3d = $state(qDebug === "1");
  const debug = $derived({ path2d: debugPath2d, path3d: debugPath3d });

  const scene = createScene({
    prefer: qs.get("backend") === "webgl" ? "webgl" : "webgpu",
    yaw: Number.isNaN(qYaw) ? 0 : qYaw,
  });
  // scroll <-> clock: the scroll track IS the timeline scrubber, and while playing
  // the bar follows the clock. Programmatic scrolls set selfScroll so their event is
  // ignored; grabbing the bar mid-track stops autoplay; scrolling to the end resumes
  // it unless the user explicitly paused.
  const SYNC_TOL = 3;   // px slack: skip scrollTo if already within this of target
  const SCRUB_TOL = 80; // Safari fires stray settle events near lastTarget; ignore those
  let t = $state(Number.isNaN(qT) ? 0 : qT);
  let playing = $state(qs.get("play") === "1");
  let userPaused = false; // explicit pause -> don't auto-resume at the end
  let selfScroll = false; // true while our programmatic scroll's event is pending
  let lastTarget = -1;    // last y we programmatically scrolled to
  const progress = $derived(Math.min(1, t / TIMELINE_END));
  const atEnd = $derived(t >= TIMELINE_END);

  function scrollTo(px) {
    const y = Math.round(px);
    lastTarget = y;
    if (Math.abs(window.scrollY - y) <= SYNC_TOL) return; // already there, no event
    selfScroll = true; // swallow the one scroll event this triggers
    window.scrollTo(0, y);
  }
  function onScroll() {
    if (selfScroll) { selfScroll = false; return; } // our own move
    const raw = window.scrollY / SCROLL_LEN;
    if (raw >= 1) { if (!userPaused) playing = true; return; } // reached end -> keep flying
    if (playing && lastTarget >= 0 && Math.abs(window.scrollY - lastTarget) <= SCRUB_TOL) return;
    playing = false; // grabbed the scrollbar -> stop autoplay, scrub
    t = raw * TIMELINE_END;
  }
  function advance(dt) { if (playing) t += dt; } // driven by the canvas frame, pauses offscreen
  function play() { playing = true; }
  function seek(p) { playing = false; userPaused = false; t = p * TIMELINE_END; scrollTo(p * SCROLL_LEN); }
  function toggle() {
    if (atEnd) { t = 0; scrollTo(0); playing = true; userPaused = false; return; }
    playing = !playing;
    userPaused = !playing;
  }
  // while playing, follow the clock with the scrollbar (unbounded past the end so
  // the scene keeps looping); a same-position scroll is a no-op
  $effect(() => { if (playing && progress < 1) scrollTo(progress * SCROLL_LEN); });

  // one fixed-size coach mark per icon -> never scales with the row width
  // lx/ly stagger each label off the row; arrow tip stays at the icon (42,6)
  const ICON_HINTS = [
    { label: "Code", rot: 6, bend: -6, lx: 38, ly: 40 },
    { label: "Resume", rot: 0, bend: 2, lx: 47, ly: 52 },
    { label: "Notes", rot: -8, bend: -3, lx: 55, ly: 44 },
  ];
  let iconEls = $state([]); // the icon links each coach mark points at
  let controlsEl = $state(null); // play + seek bar the last coach mark points at

  // coach marks show only in the empty state (top of the timeline)
  const showHints = $derived(progress < 0.02);

  $effect(() => trackMilestone(progress));
  $effect(() => scene.setConfig({ t, debug }));
</script>

<svelte:head>
  <title>hucancode</title>
  {#if D3_STYLE === "obj"}
    <link rel="preload" href="/assets/obj/dragon-low.obj" as="fetch" crossorigin />
  {/if}
</svelte:head>
<svelte:window onscroll={onScroll} />

<nav>
  <a
    href="https://github.com/hucancode"
    target="_blank"
    rel="noreferrer"
    aria-label="GitHub"
    bind:this={iconEls[0]}><RoughIcon svg={Github} /></a
  >
  <a href="/resume.pdf" download aria-label="Resume" bind:this={iconEls[1]}
    ><RoughIcon svg={Profile} /></a
  >
  <a href="/notes" aria-label="Notes" bind:this={iconEls[2]}
    ><RoughIcon svg={PersonRaiseHand} /></a
  >
  <div bind:this={controlsEl}>
    <button
      onclick={toggle}
      aria-label={atEnd ? "restart" : playing ? "pause" : "play"}
    >
      <RoughIcon svg={atEnd ? Restart : playing ? Pause : Play} />
    </button>
    <Timeline progress={progress} onseek={seek} />
    {#if showDebug}
      <label><input type="checkbox" bind:checked={debugPath2d} /> path 2d</label>
      <label><input type="checkbox" bind:checked={debugPath3d} /> path 3d</label>
    {/if}
  </div>
</nav>

<!-- empty-state coach marks: one per icon, each centered under its own icon -->
{#each ICON_HINTS as h, i}
  <CoachMark target={iconEls[i]} width={84} open={showHints}>
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
  </CoachMark>
{/each}

<CoachMark target={controlsEl} width={120} open={showHints}>
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
    <text x="60" y="54" text-anchor="middle" transform="rotate(-4 60 44)"
      >Animation!</text
    >
  </svg>
</CoachMark>

<main style:height={`calc(100vh + ${SCROLL_LEN}px)`}>
  <div>
    <PlaygroundCanvas {scene} onFrame={advance} />
  </div>
</main>

<button
  inert={!showHints}
  onclick={play}
  aria-label="play"
>
  {@html ChevronDown}
</button>

<footer inert={progress < 1}>
  <a href="/playgrounds">More like this...</a>
  <p>All animations and models are procedurally generated</p>
</footer>

<style>
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
  nav > a {
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
  nav > div {
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
  /* ?debug toggles */
  nav label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
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
  main :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: pan-y;
    cursor: grab;
  }
  main :global(canvas:active) {
    cursor: grabbing;
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
