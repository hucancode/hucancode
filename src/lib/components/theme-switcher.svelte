<script>
  import Night from "~icons/ic/twotone-dark-mode";
  import Day from "~icons/ic/twotone-light-mode";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  let id = "theme-switcher";
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
    await import("@shoelace-style/shoelace/dist/components/icon/icon");
    await import("@shoelace-style/shoelace/dist/components/switch/switch");
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
  {#if isDarkMode}
    <sl-icon
      transition:fade={{ delay: 250, duration: 300 }}
      slot="thumb"
      name="moon-stars"
    />
  {:else}
    <sl-icon
      transition:fade={{ delay: 250, duration: 300 }}
      slot="thumb"
      name="sun"
    />
  {/if}
</sl-switch>

<style>
  sl-switch {
    --height: 1.5rem;
    --width: calc(var(--height) * 2);
    --thumb-size: calc(var(--height) * 0.9);
  }
</style>
