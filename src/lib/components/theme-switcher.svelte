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
      name={isDarkMode?"moon-stars":"sun"}
    ></sl-icon>
</sl-switch>

<style>
  sl-switch {
    --height: 1.7rem;
    --width: calc(var(--height) * 2);
    --thumb-size: calc(var(--height) * 0.9);
  }
  sl-switch::part(thumb) {
    border-radius: 9999px;
    border-width: 0; 
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
  sl-icon[dark=true] {
    right: 0;
  }
  sl-icon[dark=false] {
    left: 0;
  }
</style>
