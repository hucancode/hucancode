<script>
  import { createEventDispatcher } from "svelte";
  let dispatch = createEventDispatcher();
  export let iconSources = [];
  export let active = 0;
</script>

<div class="icons">
  {#each iconSources as icon, index}
    <label class="icon-container">
      <input
        type="radio"
        name="icon"
        checked={active == index}
        on:change={(e) => {
          if (e.target.checked && active != index) {
            active = index;
            dispatch("change", index);
          }
        }}
      />
      <div class="border" />
      <div class="icon">
        {@html icon}
      </div>
    </label>
  {/each}
</div>

<style>
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.1rem;
    position: relative;
    &::before {
      content: "";
      position: absolute;
      height: 100%;
      aspect-ratio: 1;
      translate: -50% -50%;
      left: 50%;
      top: 50%;
      border-radius: 9999px;
      background-color: var(--color-neutral-950);
      filter: blur(2.5rem);
    }
    & .icon-container {
      width: 5rem;
      aspect-ratio: 1;
      position: relative;
      &:has(input[type="radio"]) {
        &:hover .border {
          opacity: 0.2;
        }
        & .border {
          opacity: 0;
          transform: rotate(-90deg);
          transition-duration: 800ms;
          transition-timing-function: ease-in-out;
        }
      }
      &:has(input[type="radio"]):hover .icon,
      &:has(input[type="radio"]:checked) .icon {
        color: white;
      }
      &:has(input[type="radio"]:checked) {
        & .border {
          opacity: 1;
          transform: rotate(0deg);
        }
      }
      &:has(input[type="radio"]) {
        overflow: hidden;
        border-radius: 9999px;
        position: relative;
        display: flex;
        align-items: center;
        & .border {
          width: 100%;
          height: 100%;
          z-index: -1;
          position: absolute;
          filter: blur(9px);
          background-repeat: no-repeat;
          background-size: 50% 50%, 50% 50%;
          background-position: 0 0, 100% 0, 100% 100%, 0 100%;
          --color-1: rgb(17, 255, 108);
          --color-2: rgb(112, 124, 255);
          --color-3: rgb(0, 6, 126);
          --color-4: rgb(0, 92, 240);
          background-image: linear-gradient(var(--color-1), var(--color-1)),
            linear-gradient(var(--color-2), var(--color-2)),
            linear-gradient(var(--color-3), var(--color-3)),
            linear-gradient(var(--color-4), var(--color-4));
        }
      }
      & .icon {
        margin: auto;
        overflow: hidden;
        display: grid;
        place-items: center;
        transition-duration: 300ms;
        border-radius: 9999px;
        background-color: black;
        z-index: 2;
        width: 90%;
        height: 90%;
        color: rgb(80, 80, 90);
        & svg {
          height: 2rem;
        }
      }
    }
  }
</style>
