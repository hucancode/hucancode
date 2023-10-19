<script>
  import { onMount } from "svelte";
  import Moon from "$icons/line-md/moon.svg?raw";
  import Sun from "$icons/line-md/sunny.svg?raw";

  let isDarkMode = false;

  function setDarkMode(value) {
    isDarkMode = value;
    if (value) {
      localStorage.theme = "dark";
      document.documentElement.classList.add("dark");
    } else {
      localStorage.theme = "light";
      document.documentElement.classList.remove("dark");
    }
  }

  onMount(async () => {
    let pickedDarkModeBefore = localStorage.theme === "dark";
    let neverPickedAnything = "theme" in localStorage;
    let preferDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (pickedDarkModeBefore || (neverPickedAnything && preferDarkMode)) {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
  });
</script>

<label>
  {#if isDarkMode}
    {@html Moon}
  {:else}
    {@html Sun}
  {/if}
  <input
    type="checkbox"
    on:change={(e) => setDarkMode(e.target.checked)}
    checked={isDarkMode || undefined}
  />
</label>

<style>
  label {
    font-size: large;
    aspect-ratio: 2;
    height: 1.85rem;
    border-radius: 9999px;
    background-color: var(--color-primary-400);
    border-color: var(--color-primary-400);
    border-style: solid;
    border-width: 0.15rem;
    position: relative;
    color: var(--color-neutral-950);
    cursor: pointer;
  }
  input {
    position: absolute;
    width: 100%;
    height: 100%;
    visibility: hidden;
  }
  label:active::before {
    width: 75%;
  }
  label:has(input:checked)::before,
  label:has(input:checked) :global(svg) {
    left: 100%;
    transform: translateX(-100%);
  }
  label :global(svg) {
    padding: 0.1rem;
  }
  label::before {
    content: "";
    background-color: var(--color-neutral-50);
    transition-property: width, left, background-color;
  }
  label::before,
  label :global(svg) {
    border-radius: 9999px;
    height: 100%;
    width: 50%;
    position: absolute;
    transition-duration: 300ms;
    pointer-events: none;
  }
</style>
