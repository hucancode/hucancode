<script>
  import Renderer from '../renderer.svelte';
  
  /** @type {{ type?: 'info' | 'warning' | 'error' | 'success' | 'note', title?: string, children?: any }} */
  let { type = 'info', title, children } = $props();
  
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    note: '📝'
  };
</script>

<div class="callout callout-{type}">
  {#if title}
    <div class="callout-title">
      <span class="callout-icon">{icons[type]}</span>
      {title}
    </div>
  {/if}
  <div class="callout-content">
    {#if children}
      <Renderer {children} />
    {/if}
  </div>
</div>

<style>
  .callout {
    margin: 1.5rem 0;
    padding: 1rem;
    border-radius: 0.5rem;
    border-left: 4px solid;
  }
  
  .callout-title {
    font-weight: bold;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .callout-icon {
    font-size: 1.2em;
  }
  
  .callout-info {
    background: var(--color-primary-100);
    border-color: var(--color-primary-500);
    color: var(--color-primary-800);
  }
  
  @media (prefers-color-scheme: dark) {
    .callout-info {
      background: rgba(122, 161, 224, 0.1);
      border-color: var(--color-primary-400);
      color: var(--color-primary-200);
    }
  }
  
  .callout-warning {
    background: rgba(255, 152, 0, 0.1);
    border-color: #ff9800;
    color: var(--color-neutral-950);
  }
  
  .callout-error {
    background: rgba(244, 67, 54, 0.1);
    border-color: #f44336;
    color: var(--color-neutral-950);
  }
  
  .callout-success {
    background: rgba(76, 175, 80, 0.1);
    border-color: #4caf50;
    color: var(--color-neutral-950);
  }
  
  .callout-note {
    background: var(--color-neutral-100);
    border-color: var(--color-neutral-500);
    color: var(--color-neutral-950);
  }
</style>