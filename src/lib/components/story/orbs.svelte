<script>
  import { onMount, onDestroy } from "svelte";
  import { createEventDispatcher } from "svelte";
  let dispatch = createEventDispatcher();
  export let iconSources = [];
  export let active = 0;
</script>

<div class="blueprint">
  <div class="card">
    <div class="icons">
      {#each iconSources as icon, index}
        <div class="icon-container">
          <div class="halo">
            <div class="icon" active={index == active}>
              {@html icon}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
<svg>
  <defs>
    <pattern
      id="pattern-stripe"
      width="4"
      height="4"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <rect width="2" height="4" transform="translate(0,0)" fill="white" />
    </pattern>
    <mask id="mask-stripe">
      <rect
        x="0"
        y="0"
        width="9999px"
        height="9999px"
        fill="url(#pattern-stripe)"
      />
    </mask>
  </defs>
</svg>
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
  .card {
    mask: url(#mask-stripe);
  }
</style>