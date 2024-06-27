<script>
  import { _ } from "$lib/i18n";
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import { scale } from "svelte/transition";
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
  } from "$lib/scenes/story/rubik";
  import {
    init as taijiInit,
    update as taijiUpdate,
    enter as taijiEnter,
    leave as taijiLeave,
  } from "$lib/scenes/story/taiji";
  import {
    init as legoInit,
    enter as legoEnter,
    leave as legoLeave,
  } from "$lib/scenes/story/lego";
  import {
    init as warriorInit,
    enter as warriorEnter,
    update as warriorUpdate,
    leave as warriorLeave,
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
  let canvas;
  let ready = false;
  const preloadAssets = [
    "/assets/gltf/dragon.glb",
    "/assets/gltf/warrior.glb",
    "/assets/textures/body_Diffuse.png",
    "/assets/textures/body_Emissive.png",
    "/assets/textures/body_Glossiness.png",
    "/assets/textures/body_Normal.png",
    "/assets/textures/body_Specular.png",
    "/assets/textures/sword_Diffuse.png",
    "/assets/textures/sword_Emissive.png",
    "/assets/textures/sword_Glossiness.png",
    "/assets/textures/sword_Normal.png",
    "/assets/textures/sword_Specular.png",
  ];

  let showcases = [
    {
      icon: planetIcon,
      init: legoInit,
      enter: legoEnter,
      leave: legoLeave,
    },
    {
      icon: cubeIcon,
      init: rubikInit,
      enter: rubikEnter,
      leave: rubikLeave,
    },
    {
      icon: dragonIcon,
      init: taijiInit,
      enter: taijiEnter,
      leave: taijiLeave,
      update: taijiUpdate,
    },
    {
      icon: warriorIcon,
      init: warriorInit,
      enter: warriorEnter,
      update: warriorUpdate,
      leave: warriorLeave,
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
    for (let showcase of showcases) {
      showcase.init(scene, camera, renderer);
    }
    onShowcaseChange({ detail: currentShowcase });
    frameID = requestAnimationFrame(loop);
    ready = true;
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
  }
</script>

<svelte:head>
  {#each preloadAssets as asset}
    <link rel="preload" href={asset} as="fetch" />
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
      <canvas bind:this={canvas} />
      {#if !ready}
        <span out:scale={{ start: 3.0, duration: 800 }} />
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
