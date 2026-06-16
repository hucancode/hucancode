<script>
  import Return from "$icons/line-md/chevron-left.svg?raw";

  /**
   * Shared layout for playground pages: a big stage + a tuning panel of
   * educational knobs, plus an optional notes block explaining the params.
   *
   * @typedef {Object} Props
   * @property {string} title
   * @property {import('svelte').Snippet} [stage]    the canvas / renderer
   * @property {import('svelte').Snippet} [controls] tuning knobs
   * @property {import('svelte').Snippet} [notes]    short explainer text
   */

  /** @type {Props} */
  let { title, stage, controls, notes } = $props();
  let open = $state(true);
</script>

<section class="playground">
  <header>
    <a class="back" href="/playgrounds">{@html Return} Playgrounds</a>
    <h1>{title}</h1>
  </header>

  <div class="layout">
    <div class="stage">
      {@render stage?.()}
    </div>

    <aside class="panel" class:open>
      <button class="toggle" onclick={() => (open = !open)} aria-expanded={open}>
        {open ? "✕ Hide controls" : "⚙ Tune"}
      </button>
      {#if open}
        <div class="body">
          <div class="controls">
            {@render controls?.()}
          </div>
          {#if notes}
            <div class="notes">
              {@render notes?.()}
            </div>
          {/if}
        </div>
      {/if}
    </aside>
  </div>
</section>

<style>
  .playground {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 1rem;
    gap: 1rem;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #6b4e71;
    text-decoration: none;
    font-size: 0.95rem;
  }
  .back:hover {
    text-decoration: underline;
  }
  .back :global(svg) {
    width: 1.2rem;
    height: 1.2rem;
  }
  h1 {
    margin: 0;
    font-size: 1.4rem;
  }
  .layout {
    flex-grow: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  @media (min-width: 860px) {
    .layout {
      grid-template-columns: 1fr 300px;
    }
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    min-height: 360px;
    border-radius: 0.6rem;
    overflow: hidden;
    background: radial-gradient(closest-side, rgba(0, 0, 0, 0.04), transparent);
  }
  .panel {
    align-self: start;
    border: 1px solid var(--color-neutral-200, rgba(0, 0, 0, 0.12));
    border-radius: 0.6rem;
    padding: 0.75rem;
  }
  .toggle {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    color: #6b4e71;
    padding: 0.25rem;
    text-align: left;
  }
  .body {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  /* shared control styling, used by pages via class names */
  .controls :global(.row) {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
  }
  .controls :global(.row > span) {
    display: flex;
    justify-content: space-between;
    color: var(--color-neutral-700, #444);
    font-weight: 500;
  }
  .controls :global(.row .val) {
    color: var(--color-neutral-400, #999);
    font-variant-numeric: tabular-nums;
  }
  .controls :global(input[type="range"]) {
    width: 100%;
    accent-color: #6b4e71;
  }
  .controls :global(select),
  .controls :global(button.action) {
    width: 100%;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--color-neutral-300, rgba(0, 0, 0, 0.2));
    border-radius: 0.4rem;
    background: var(--color-neutral-50, #fafafa);
    font: inherit;
    cursor: pointer;
  }
  .controls :global(.toggle-row) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .controls :global(.seg) {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .controls :global(.seg button) {
    flex: 1 1 auto;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--color-neutral-300, rgba(0, 0, 0, 0.2));
    border-radius: 0.4rem;
    background: var(--color-neutral-50, #fafafa);
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .controls :global(.seg button[aria-pressed="true"]) {
    background: #6b4e71;
    color: white;
    border-color: #6b4e71;
  }
  .notes {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--color-neutral-600, #666);
    border-top: 1px solid var(--color-neutral-200, rgba(0, 0, 0, 0.1));
    padding-top: 0.75rem;
  }
  .notes :global(p) {
    margin: 0 0 0.5rem;
  }
</style>
