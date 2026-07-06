<script>
  import PlaygroundCanvas from "$lib/components/playground-canvas.svelte";
  import * as dragon from "$lib/playgrounds/dragon";

  const MAX_DRAGON = 8;

  export function performMagic() {
    if (dragon.getCurrentDragonCount() > MAX_DRAGON) {
      dragon.clearDragon();
    }
    dragon.makeDragon();
  }

  // Playground API ---------------------------------------------------------
  // change a knob that only affects the live render (speed, lights)
  export function apply(patch) {
    dragon.setConfig(patch);
  }
  // change a knob that reshapes the curve -> rebuild onto a new path
  export function reshape(patch) {
    dragon.setConfig(patch);
    dragon.regenerate();
  }
  export function newPath() {
    dragon.regenerate();
  }
  export function addDragon() {
    if (dragon.getCurrentDragonCount() >= MAX_DRAGON) return;
    dragon.makeDragon();
  }
  export function reset() {
    dragon.clearDragon();
    dragon.makeDragon();
  }
  export function count() {
    return dragon.getCurrentDragonCount();
  }
</script>

<PlaygroundCanvas scene={dragon} id="dragon" />
