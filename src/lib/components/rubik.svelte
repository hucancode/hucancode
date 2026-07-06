<script>
  import PlaygroundCanvas from "$lib/components/playground-canvas.svelte";
  import * as rubik from "$lib/playgrounds/rubik";

  /** @type {number} */
  let { size = 3 } = $props();
  rubik.setCubeSize(size); // must precede init (canvas host mounts after this)

  // Playground API
  export function apply(patch) {
    rubik.setConfig(patch);
  }
  export function stepOnce() {
    rubik.step();
  }
</script>

<PlaygroundCanvas scene={rubik} id="rubik" />
