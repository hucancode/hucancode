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
  } from "$lib/scenes/taiji";
  import {
    AmbientLight,
    HemisphereLight,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
  } from "three";

  const CANVAS_ID = "taiji";
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
    camera.position.set(0, 48, 48);
    camera.lookAt(0, 0, 0);
    
    // Add lighting (same as story scene)
    const ambientLight = new AmbientLight(0x003973, 6);
    const hemiLight = new HemisphereLight(0x999999, 0x000000, 10);
    hemiLight.position.set(0, 30, 0);
    scene.add(ambientLight);
    scene.add(hemiLight);
    
    renderer = new WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    
    await init();
    enter(scene, camera, null);
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
