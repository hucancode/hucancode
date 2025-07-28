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
  } from "$lib/scenes/warrior";
  import {
    AmbientLight,
    HemisphereLight,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
  } from "three";

  const CANVAS_ID = "warrior";
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
    camera = new PerspectiveCamera(45, w / h, 0.001, 1000);
    camera.position.set(28, 42, 28);  // 7x zoom out from (4, 6, 4)
    camera.lookAt(0, 1, 0);
    
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
    
    await init(scene, camera, renderer);
    enter(scene, camera);
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
