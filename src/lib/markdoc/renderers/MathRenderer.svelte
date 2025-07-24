<script>
  import { onMount } from 'svelte';
  import katex from 'katex';
  
  /** @type {{ content?: string, type?: 'inline' | 'block', children?: any }} */
  let { content, type = 'inline', children } = $props();
  
  let mathElement = $state();
  let error = $state(null);
  
  onMount(() => {
    // Use content prop directly if available
    let mathContent = content;
    
    // If no content prop, try to extract from children
    if (!mathContent && children && Array.isArray(children)) {
      mathContent = children.map(child => {
        if (typeof child === 'string') return child;
        if (child?.name === 'text' && child?.children) {
          return child.children.join('');
        }
        return '';
      }).join('').trim();
    }
    
    if (!mathContent) {
      error = 'No math content provided';
      return;
    }
    
    try {
      katex.render(mathContent, mathElement, {
        displayMode: type === 'block',
        throwOnError: false,
        errorColor: '#cc0000',
        trust: true,
        strict: false,
        macros: {
          "\\align": "\\begin{align}",
          "\\aligned": "\\begin{aligned}",
        }
      });
    } catch (err) {
      error = err.message;
      console.error('KaTeX rendering error:', err);
    }
  });
</script>

{#if type === 'inline'}
  <span bind:this={mathElement} class="math-inline"></span>
{:else}
  <div bind:this={mathElement} class="math-block"></div>
{/if}

{#if error}
  <span class="math-error">Math rendering error: {error}</span>
{/if}

<style>
  .math-inline {
    display: inline;
  }
  
  .math-block {
    display: block;
    text-align: center;
    margin: 1.5rem 0;
  }
  
  .math-error {
    color: var(--color-error, #cc0000);
    font-size: 0.875rem;
    font-style: italic;
  }
</style>