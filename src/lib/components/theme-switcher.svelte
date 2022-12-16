<script>
  import { onMount } from "svelte";

  let id = "theme-switcher";
  let isDarkMode = false;

  function setDarkMode(value) {
    if (value) {
      localStorage.theme = "dark";
      document.documentElement.classList.add("dark");
    } else {
      localStorage.theme = "light";
      document.documentElement.classList.remove("dark");
    }
    isDarkMode = value;
  }

  onMount(() => {
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

<div class="flex w-full items-center justify-center">
  <input
    {id}
    type="checkbox"
    class="peer hidden"
    checked={isDarkMode}
    on:change={() => {
      setDarkMode(!isDarkMode);
    }}
  />
  <label
    for={id}
    class="relative m-4 block
        aspect-[2]
        h-8
        cursor-pointer rounded-2xl bg-blue-300
        duration-500
        after:absolute
        after:top-1 
        after:left-1
        after:h-6
        after:w-6
        after:rounded-full
        after:bg-white
        after:duration-300
        active:after:w-3/5
        peer-checked:bg-gray-700
        peer-checked:after:left-[calc(100%-0.2rem)]
        peer-checked:after:-translate-x-full
        peer-checked:dark:bg-gray-500"
  />
</div>
