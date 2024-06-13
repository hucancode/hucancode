<script>
  import { createEventDispatcher } from "svelte";
  let dispatch = createEventDispatcher();
  export let iconSources = [];
  export let active = 0;
</script>

<div class="-blueprint">
  <div class="card">
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
          <div class="halo">
            <div class="icon">
              {@html icon}
            </div>
          </div>
        </label>
      {/each}
    </div>
  </div>
</div>

<style>
  .blueprint {
    width: 100%;
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
    flex: 1;
  }

  @media (max-width: 768px) {
    .blueprint {
      flex-direction: column;
    }
  }
  .-card {
    mask: url(#mask-stripe);
  }
</style>
