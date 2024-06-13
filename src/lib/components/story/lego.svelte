<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import ScrollObserver from "$lib/components/scroll-observer.svelte";
  import Orbs from "$lib/components/story/orbs.svelte";
  import planetIcon from "$icons/ph/planet.svg?raw";
  import dragonIcon from "$icons/game-icons/dragon.svg?raw";
  import cubeIcon from "$icons/mdi/cube.svg?raw";
  import {
    enter as rubikEnter,
    leave as rubikLeave,
  } from "$lib/scenes/story/rubik";
  import {
    makeDragon,
    update as taijiUpdate,
    enter as taijiEnter,
    leave as taijiLeave,
  } from "$lib/scenes/story/taiji";
  import {
    enter as legoEnter,
    leave as legoLeave,
  } from "$lib/scenes/story/lego";
  import {
    init,
    destroy,
    render,
    scene,
    camera,
  } from "$lib/scenes/story/scene";
  let frameID;
  let canvas;
  let activeShowcase = 0;

  let showcases = [
    {
      title: $_("story.lego.title"),
      description: $_("story.lego.description"),
      enter: legoEnter,
      leave: legoLeave,
    },
    {
      title: $_("story.rubik.title"),
      description: $_("story.rubik.description"),
      enter: rubikEnter,
      leave: rubikLeave,
    },
    {
      title: $_("story.taiji.title"),
      description: $_("story.taiji.description"),
      init: makeDragon,
      enter: taijiEnter,
      leave: taijiLeave,
      update: taijiUpdate,
    },
  ];
  let currentShowcase = 0;

  function onScroll(e) {
    let r = e.detail;
    // animateCamera(Math.min(1, r));
    if (r > 0 && frameID === 0) {
      frameID = requestAnimationFrame(loop);
    }
    if (r <= 0 || r >= 2) {
      cancelAnimationFrame(frameID);
      frameID = 0;
    }
  }
  onMount(async () => {
    if (!browser) return;
    await init(canvas);
    for (let showcase of showcases) {
      if (showcase.init) {
        await showcase.init();
      }
    }
    onShowcaseChange({ detail: currentShowcase });
    frameID = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (!browser) return;
    showcaseLeave();
    cancelAnimationFrame(frameID);
    frameID = 0;
    destroy();
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    showcaseUpdate();
    render();
  }

  function showcaseEnter() {
    showcases[currentShowcase].enter(scene);
  }

  function showcaseLeave() {
    showcases[currentShowcase].leave(scene);
  }

  function showcaseUpdate() {
    if (!showcases[currentShowcase].update) {
      return;
    }
    showcases[currentShowcase].update(scene);
  }

  function onShowcaseChange(e) {
    let index = e.detail;
    showcaseLeave();
    currentShowcase = index;
    showcaseEnter();
  }
</script>

<section>
  <div class="explain">
    <h1 rainbow="1" class="xl">Greetings!</h1>
    <h1>
      My name is Bang, I am a creative software engineer
      <input type="checkbox" id="expander" />
      <label for="expander">...</label>
      <span>and I use Arch by the way 😎</span>
    </h1>
    <p>Let's build something amazing together!</p>
  </div>
  <div>
    <Orbs
      iconSources={[planetIcon, cubeIcon, dragonIcon]}
      on:change={onShowcaseChange}
    />
  </div>
  <ScrollObserver on:scroll={onScroll} threshold={30}>
    <canvas bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
  input[type="checkbox"] {
    display: none;
    & + label {
      display: contents;
      cursor: pointer;
    }
    & + label:hover {
      color: var(--color-primary-500);
    }
    &:checked + label {
      display: none;
    }
    &:checked ~ span {
      display: contents;
    }
    & ~ span {
      display: none;
    }
  }
  section {
    height: auto;
    flex-direction: column;
  }
  h1.xl {
    font-size: 3.5rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
    text-align: center;
  }
  p {
    text-align: center;
    max-width: 640px;
  }
</style>
