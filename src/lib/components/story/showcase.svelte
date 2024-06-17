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
    init,
    destroy,
    render,
    scene,
    camera,
    controls,
  } from "$lib/scenes/story/scene";
  let frameID;
  let canvas;

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

<section>
  <Orbs
    iconSources={showcases.map((showcase) => showcase.icon)}
    on:change={onShowcaseChange}
  />
  <noscript>
    <p>{$_("home.landing.noscript")}<br/>
    <a href="https://www.enable-javascript.com/">{$_("home.landing.enablejs")}</a>
    </p>
  </noscript>
  <ScrollObserver on:scroll={onScroll} threshold={30}>
    <canvas bind:this={canvas} />
  </ScrollObserver>
</section>

<style>
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
</style>
