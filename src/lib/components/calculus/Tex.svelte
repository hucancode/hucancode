<script>
  import katex from "katex";

  let { tex = "", display = false } = $props();
  let el = $state();

  $effect(() => {
    if (!el) return;
    try {
      katex.render(tex, el, {
        displayMode: display,
        throwOnError: false,
        errorColor: "#cc0000",
        strict: false,
      });
    } catch (e) {
      el.textContent = tex;
    }
  });
</script>

{#if display}
  <div bind:this={el} class="math-block"></div>
{:else}
  <span bind:this={el} class="math-inline"></span>
{/if}
