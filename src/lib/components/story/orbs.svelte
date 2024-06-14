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
      background-color: white;
      filter: blur(3rem);
    }
    & .icon-container {
      width: 5rem;
      aspect-ratio: 1;
      position: relative;
      &:has(input[type="radio"]) {
        & .border {
          opacity: 0;
          transition-duration: 500ms;
        }
      }
      &:has(input[type="radio"]):hover .icon,
      &:has(input[type="radio"]:checked) .icon {
        color: white;
      }
      &:has(input[type="radio"]:checked) {
        & .border {
          opacity: 1;
        }
      }
      &:has(input[type="radio"]) {
        overflow: hidden;
        border-radius: 9999px;
        position: relative;
        display: flex;
        align-items: center;
        & .border {
          overflow: hidden;
          animation: spin 10s linear infinite;
          transform-origin: 50% 50%;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          z-index: -1;
          position: absolute;
          border-radius: 9999px;
          filter: blur(9px);
          background-repeat: no-repeat;
          background-size: 50% 50%, 50% 50%;
          background-position: 0 0, 100% 0, 100% 100%, 0 100%;
          --color-1: rgb(220, 250, 19);
          --color-2: rgb(131, 66, 251);
          --color-3: rgb(38, 23, 249);
          --color-4: rgb(245, 19, 32);
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
        width: 92%;
        height: 92%;
        color: gray;
        & svg {
          height: 2rem;
        }
      }
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
