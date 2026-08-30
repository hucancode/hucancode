<script>
  // Fixed-size coach mark pinned under a target element. Lives in the top layer
  // (popover), so it is positioned by JS -- CSS anchor positioning is not
  // shipped everywhere yet. Never scales with the target: only its anchor moves.
  let { target = null, width = 100, open = false, children } = $props();

  let el = $state(null);

  // center the fixed-width popover under the target
  function place() {
    if (!el || !target) return;
    const r = target.getBoundingClientRect();
    el.style.left = `${r.left + r.width / 2 - width / 2}px`;
    el.style.top = `${r.bottom}px`;
    el.style.width = `${width}px`;
  }

  $effect(() => {
    if (!el) return;
    const isOpen = el.matches?.(":popover-open");
    if (open) {
      place(); // target may have moved while we were hidden
      if (!isOpen) el.showPopover?.();
    } else if (isOpen) {
      el.hidePopover?.();
    }
  });
</script>

<svelte:window onresize={place} />

<aside popover="manual" bind:this={el} aria-hidden="true">{@render children?.()}</aside>

<style>
  aside {
    margin: 0;
    border: none;
    background: none;
    padding: 0;
    inset: auto; /* reset UA popover centering; JS sets left/top/width */
    position: fixed;
    overflow: visible; /* let rotated labels spill past the row width */
    color: var(--ink);
    pointer-events: none; /* never block icon clicks / canvas drags */
    opacity: 0;
    transition:
      opacity 0.4s ease,
      overlay 0.4s allow-discrete,
      display 0.4s allow-discrete;
  }
  aside:popover-open {
    opacity: 0.95;
  }
  @starting-style {
    aside:popover-open {
      opacity: 0;
    }
  }
  aside :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
  aside :global(text) {
    font-family: "Virgil", cursive;
    font-size: 17px;
    fill: currentColor;
  }
</style>
