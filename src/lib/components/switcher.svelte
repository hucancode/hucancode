<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id = "switcher";
  export let labelA;
  export let labelB;
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

<div class="outline-gray-900/10 dark:outline-white/10">
  <input
    {id}
    type="checkbox"
    class="peer"
    checked={value}
    on:change={switchAB}
  />
  <h3
    class="text-red-600 peer-checked:text-gray-700 dark:peer-checked:text-gray-400"
    on:click={selectA}
  >
    {labelA}
  </h3>
  <label for={id} class="peer-checked:-translate-x-1/3
		dark:bg-gray-700">
    <span />
    <span />
  </label>
  <h3
    class="text-gray-700 peer-checked:text-red-600 dark:text-gray-400"
    on:click={selectB}
  >
    {labelB}
  </h3>
</div>

<style lang="postcss">
  div {
    @apply flex items-center justify-center relative overflow-hidden max-w-lg outline outline-1 ;
  }
  input {
    @apply hidden;
  }
  label {
    @apply absolute left-0
      flex
			h-full
			w-[150%]
			cursor-pointer justify-between rounded-2xl
        bg-sky-200 duration-100
		;
  }
  span {
    @apply h-full w-1/3 bg-black;
  }
  h3 {
    @apply z-10
  w-1/2 cursor-pointer
			select-none
			px-4
			py-2
			text-xs
			duration-300 md:text-base;
  }
</style>
