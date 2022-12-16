<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id = "switcher";
  export let value = false;

  function notify() {
    dispatch("change", { value: value });
  }
  function selectA() {
    value = false;
    notify();
  }

  function selectB() {
    value = true;
    notify();
  }

  function switchAB() {
    value = !value;
    notify();
  }
</script>

<div
  class="relative flex max-w-lg items-center justify-center overflow-hidden outline outline-1 outline-gray-900/10 dark:outline-white/10"
>
  <input
    {id}
    type="checkbox"
    class="peer hidden"
    checked={value}
    on:change={switchAB}
  />
  <button
    class="z-10 w-1/2 cursor-pointer
			select-none
			px-4
			py-2
			text-xs
			text-red-600 duration-300 peer-checked:text-gray-700 dark:peer-checked:text-gray-400 md:text-base"
    on:click={selectA}
  >
    <slot name="label-a">Label A</slot>
  </button>
  <label
    for={id}
    class="absolute left-0 flex h-full
      w-[150%]
			cursor-pointer
			justify-between
			rounded-2xl bg-sky-200 duration-100 peer-checked:-translate-x-1/3 dark:bg-gray-700"
  >
    <span class="h-full w-1/3 bg-black" />
    <span class="h-full w-1/3 bg-black" />
  </label>
  <button
    class="z-10 w-1/2 cursor-pointer
			select-none
			px-4
			py-2
			text-xs
			text-gray-700 duration-300 peer-checked:text-red-600 dark:text-gray-400 md:text-base"
    on:click={selectB}
  >
    <slot name="label-b">Label B</slot>
  </button>
</div>
