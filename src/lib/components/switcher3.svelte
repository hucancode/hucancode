<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id = "switcher";
  export let value = 0;

  function notify() {
    dispatch("change", { value: value });
  }
  function selectA() {
    value = 0;
    notify();
  }

  function selectB() {
    value = 1;
    notify();
  }

  function selectC() {
    value = 2;
    notify();
  }

  export function userSelectA() {
    value = 0;
  }

  export function userSelectB() {
    value = 1;
  }

  export function userSelectC() {
    value = 2;
  }
</script>

<div
  class="relative flex max-w-lg items-center justify-center overflow-hidden bg-gray-500 outline outline-1 outline-gray-900 dark:bg-gray-800 dark:outline-white/10"
>
  <div class="contents">
    <input
      name={id}
      id={id + "A"}
      type="radio"
      class="peer hidden"
      checked={value === 0}
      on:change={selectA}
    />
    <label
      for={id + "A"}
      class="z-10 cursor-pointer
			px-4
			py-2
			text-xs
			duration-300 peer-checked:bg-gray-700 dark:peer-checked:bg-black md:text-base"
    >
      <slot name="label-a">Label A</slot>
    </label>
  </div>
  <div class="contents">
    <input
      name={id}
      id={id + "B"}
      type="radio"
      class="peer hidden"
      checked={value === 1}
      on:change={selectB}
    />
    <label
      for={id + "B"}
      class="z-10 cursor-pointer
			px-4
			py-2
			text-xs
			duration-300 peer-checked:bg-gray-700 dark:peer-checked:bg-black md:text-base"
    >
      <slot name="label-b">Label B</slot>
    </label>
  </div>
  <div class="contents">
    <input
      name={id}
      id={id + "C"}
      type="radio"
      class="peer hidden"
      checked={value === 2}
      on:change={selectC}
    />
    <label
      for={id + "C"}
      class="z-10 cursor-pointer
			px-4
			py-2
			text-xs
			duration-300 peer-checked:bg-gray-700 dark:peer-checked:bg-black md:text-base"
    >
      <slot name="label-c">Label C</slot>
    </label>
  </div>
</div>
