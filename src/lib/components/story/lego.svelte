<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import ScrollObserver from "$lib/components/scroll-observer.svelte";
  // import Orbs from "$lib/components/story/orbs.svelte";
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

  let showcases = [
    {
      title: $_("story.lego.title"),
      description: $_("story.lego.description"),
      icon: "🧱",
      enter: legoEnter,
      leave: legoLeave,
    },
    {
      title: $_("story.rubik.title"),
      description: $_("story.rubik.description"),
      icon: "🧩",
      enter: rubikEnter,
      leave: rubikLeave,
    },
    {
      title: $_("story.taiji.title"),
      description: $_("story.taiji.description"),
      icon: "🐉",
      enter: taijiEnter,
      leave: taijiLeave,
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
    await makeDragon();
    taijiEnter(scene);
    frameID = requestAnimationFrame(loop);
  });

  onDestroy(() => {
    if (!browser) return;
    taijiLeave(scene);
    cancelAnimationFrame(frameID);
    frameID = 0;
    destroy();
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    taijiUpdate();
    render();
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
  <!-- <Orbs iconSources={[]} /> -->
    <button
      on:click={() => {
        legoEnter(scene);
        taijiLeave(scene);
      }}>Lego Enter</button
    >
    <button
      on:click={() => {
        legoLeave(scene);
        taijiEnter(scene);
      }}>Lego Leave</button
    >
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
