<script>
  import Renderer from '../renderer.svelte';
  
  /** @type {{ title: string, defaultOpen?: boolean, children?: any }} */
  let { title, defaultOpen = false, children } = $props();
  
  let isOpen = $state(defaultOpen);
</script>

<div class="accordion">
  <button 
    class="accordion-header" 
    onclick={() => isOpen = !isOpen}
    aria-expanded={isOpen}
  >
    <span class="accordion-title">{title}</span>
    <span class="accordion-icon" class:open={isOpen}>▶</span>
  </button>
  {#if isOpen}
    <div class="accordion-content">
      {#if children}
        <Renderer {children} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .accordion {
    margin: 1rem 0;
    border: 1px solid var(--color-neutral-300);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .accordion-header {
    width: 100%;
    padding: 1rem;
    background: var(--color-neutral-100);
    border: none;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    font-weight: 500;
    text-align: left;
    transition: background 0.2s;
    color: var(--color-neutral-950);
  }
  
  .accordion-header:hover {
    background: var(--color-neutral-200);
  }
  
  .accordion-icon {
    transition: transform 0.2s;
    font-size: 0.75rem;
    color: var(--color-neutral-700);
  }
  
  .accordion-icon.open {
    transform: rotate(90deg);
  }
  
  .accordion-content {
    padding: 1rem;
    border-top: 1px solid var(--color-neutral-300);
    animation: slideDown 0.2s ease-out;
    background: var(--color-neutral-50);
    color: var(--color-neutral-950);
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>