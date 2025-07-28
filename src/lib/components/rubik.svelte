<script>
  import { browser } from "$app/environment";
  import { onMount, onDestroy } from "svelte";
  import Canvas3D from "./canvas3d.svelte";
  import {
    init,
    destroy,
    update,
    enter,
    leave
  } from "$lib/scenes/rubik";
  import {
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
  } from "three";

  const CANVAS_ID = "rubik";
  let ready = $state(false);
  let scene, camera, renderer;

  function render() {
    if (!ready) return;
    update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  onMount(async () => {
    const canvas = document.getElementById(CANVAS_ID);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    
    scene = new Scene();
    camera = new PerspectiveCamera(45, w / h, 1, 2000);
    camera.position.set(40, 40, 40);
    camera.lookAt(0, 0, 0);
    
    renderer = new WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    
    await init();
    enter(scene);
    ready = true;
  });

  onDestroy(() => {
    if (browser) {
      leave(scene);
      destroy();
      if (renderer) {
        renderer.dispose();
      }
    }
  });
</script>

<Canvas3D {ready} id={CANVAS_ID} {render} />
