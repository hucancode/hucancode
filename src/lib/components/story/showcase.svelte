<script>
  import { browser } from "$app/environment";
  import { _ } from "$lib/i18n";
  import { onMount, onDestroy } from "svelte";
  import { scale } from "svelte/transition";
  import { gtag } from "$lib/ga";
  import ScrollObserver from "$lib/components/scroll-observer.svelte";
  import Orbs from "$lib/components/story/orbs.svelte";
  import planetIcon from "$icons/ph/planet.svg?raw";
  import dragonIcon from "$icons/game-icons/dragon.svg?raw";
  import warriorIcon from "$icons/game-icons/lizard-tongue.svg?raw";
  import cubeIcon from "$icons/mdi/cube.svg?raw";
  import {
    init as rubikInit,
    enter as rubikEnter,
    leave as rubikLeave,
    destroy as rubikDestroy,
  } from "$lib/scenes/story/rubik";
  import {
    init as taijiInit,
    update as taijiUpdate,
    enter as taijiEnter,
    leave as taijiLeave,
    destroy as taijiDestroy,
  } from "$lib/scenes/story/taiji";
  import {
    init as legoInit,
    enter as legoEnter,
    leave as legoLeave,
    destroy as legoDestroy,
  } from "$lib/scenes/story/lego";
  import {
    init as warriorInit,
    enter as warriorEnter,
    update as warriorUpdate,
    leave as warriorLeave,
    destroy as warriorDestroy,
  } from "$lib/scenes/story/warrior";
  import {
    init,
    destroy,
    renderer,
    scene,
    camera,
    controls,
  } from "$lib/scenes/story/scene";
  let frameID;
  let canvas = $state();
  let ready = $state(false);
  const preloadAssets = [
    "/assets/gltf/dragon-low.glb",
    "/assets/gltf/warrior.glb",
    // "/assets/textures/body_Diffuse.png",
    // "/assets/textures/body_Emissive.png",
    // "/assets/textures/body_Glossiness.png",
    // "/assets/textures/body_Normal.png",
    // "/assets/textures/body_Specular.png",
    // "/assets/textures/sword_Diffuse.png",
    // "/assets/textures/sword_Emissive.png",
    // "/assets/textures/sword_Glossiness.png",
    // "/assets/textures/sword_Normal.png",
    // "/assets/textures/sword_Specular.png",
  ];

  let showcases = [
    {
      name: "lego",
      icon: planetIcon,
      init: legoInit,
      enter: legoEnter,
      leave: legoLeave,
      destroy: legoDestroy,
    },
    {
      name: "rubik",
      icon: cubeIcon,
      init: rubikInit,
      enter: rubikEnter,
      leave: rubikLeave,
      destroy: rubikDestroy,
    },
    {
      name: "taiji",
      icon: dragonIcon,
      init: taijiInit,
      enter: taijiEnter,
      leave: taijiLeave,
      update: taijiUpdate,
      destroy: taijiDestroy,
    },
    {
      name: "warrior",
      icon: warriorIcon,
      init: warriorInit,
      enter: warriorEnter,
      update: warriorUpdate,
      leave: warriorLeave,
      destroy: warriorDestroy,
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
    ready = false;
    await init(canvas);
    if (!scene) {
      return;
    }
    for (let { init } of showcases) {
      init && init(scene, camera, renderer);
    }
    onShowcaseChange({ detail: currentShowcase, automatic: true });
    frameID = requestAnimationFrame(loop);
    ready = true;
  });

  onDestroy(() => {
    if (!browser) return;
    showcaseLeave();
    for (let { destroy } of showcases) {
      destroy && destroy();
    }
    cancelAnimationFrame(frameID);
    frameID = 0;
    destroy();
  });

  function loop() {
    frameID = requestAnimationFrame(loop);
    showcaseUpdate();
  }

  function showcaseEnter() {
    showcases[currentShowcase].enter(scene, camera, controls);
  }

  function showcaseLeave() {
    showcases[currentShowcase].leave(scene, camera, controls);
  }

  function showcaseUpdate() {
    if (!showcases[currentShowcase].update) {
      return;
    }
    showcases[currentShowcase].update(scene, camera, controls);
  }

  function onShowcaseChange(e) {
    let index = e.detail;
    showcaseLeave();
    currentShowcase = index;
    showcaseEnter();
    if (!e.automatic) {
      let name = showcases[currentShowcase].name;
      gtag("event", "select_showcase", {
        value: name,
      });
    }
  }
</script>

<svelte:head>
  {#each preloadAssets as asset}
    <link rel="preload" href={asset} as="fetch" crossorigin />
  {/each}
</svelte:head>
<section>
  <Orbs
    iconSources={showcases.map((e) => e.icon)}
    on:change={onShowcaseChange}
  />
  <noscript>
    <p>
      {$_("home.landing.noscript")}<br />
      <a href="https://www.enable-javascript.com/"
        >{$_("home.landing.enablejs")}</a
      >
    </p>
  </noscript>
  <ScrollObserver on:scroll={onScroll} threshold={30}>
    <div>
      <canvas bind:this={canvas}></canvas>
      {#if !ready}
        <span out:scale={{ start: 3.0, duration: 800 }}></span>
      {/if}
    </div>
  </ScrollObserver>
</section>

<style>
  div {
    position: relative;
    width: 100%;
    aspect-ratio: 4/3;
    display: flex;
  }
  section {
    padding: 5rem 1rem;
    min-height: 60vh;
    height: auto;
    flex-direction: column;
  }
  p {
    text-align: center;
    margin-top: 1rem;
  }
  span {
    z-index: 10;
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    width: 4rem;
    aspect-ratio: 1;
    border: 0.8rem solid var(--color-primary-500);
    border-bottom-color: transparent;
    border-radius: 50%;
    animation: rotation 1s linear infinite;
  }
  @keyframes rotation {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
