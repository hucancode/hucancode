<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  let isDarkMode = false;

  function setDarkMode(value) {
    if (value) {
      localStorage.theme = "dark";
      document.documentElement.classList.add("sl-theme-dark");
    } else {
      localStorage.theme = "light";
      document.documentElement.classList.remove("sl-theme-dark");
    }
    isDarkMode = value;
  }

  onMount(async () => {
    await import("$shoelace/icon/icon");
    await import("$shoelace/switch/switch");
    let pickedDarkModeBefore = localStorage.theme === "dark";
    let neverPickedAnything = "theme" in localStorage;
    let preferDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (pickedDarkModeBefore || (neverPickedAnything && preferDarkMode)) {
      setDarkMode(true);
    }
  });
</script>

<sl-switch
  on:sl-change={(e) => setDarkMode(e.target.checked)}
  checked={isDarkMode}
>
  <sl-icon
    dark={isDarkMode}
    name={isDarkMode ? "sun-to-moon" : "sun-rising"}
    library="line-md"
  />
</sl-switch>

<style>
  sl-switch {
    --height: 1.7rem;
    --width: calc(var(--height) * 2);
    --thumb-size: calc(var(--height) * 0.9);
  }
  sl-switch::part(thumb) {
    position: absolute;
    border-radius: 9999px;
    border-width: 0;
    transition-duration: 300ms;
    width: var(--thumb-size);
    left: calc(var(--height) * 0.5);
    transition-property: width;
  }
  sl-switch:active::part(thumb) {
    width: calc(var(--thumb-size) * 1.5);
  }
  sl-switch[checked]::part(thumb) {
    right: calc(var(--height) * 0.5);
    left: unset;
  }
  sl-switch::part(label) {
    position: absolute;
    margin: 0;
    width: 100%;
    height: 100%;
  }
  sl-icon {
    position: absolute;
    aspect-ratio: 1/1;
    transform-origin: center;
    height: calc(var(--height) * 0.65);
    padding: calc(var(--height) * 0.18);
  }
  sl-icon[dark="true"] {
    right: 0;
  }
  sl-icon[dark="false"] {
    left: 0;
  }
</style>
