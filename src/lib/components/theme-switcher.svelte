<script>
  import Night from "~icons/ic/twotone-dark-mode";
  import Day from "~icons/ic/twotone-light-mode";
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
  class="relative flex aspect-[2] h-8
        cursor-pointer
        items-center
        justify-between rounded-2xl bg-blue-300
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
>
  <Day
    class="duration-600 z-10 w-1/2 text-gray-400 opacity-100 ease-in-out dark:opacity-0"
  />
  <Night
    class="duration-600 z-10 w-1/2 text-gray-400 opacity-0 ease-in-out dark:opacity-100"
  />
</label>
