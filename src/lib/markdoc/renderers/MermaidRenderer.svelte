<script>
  import { onMount } from 'svelte';
  import mermaid from 'mermaid';
  
  /** @type {{ content?: string, theme?: string }} */
  let { content = '', theme = 'default' } = $props();
  
  let container;
  let rendered = $state(false);
  let currentTheme = $state('default');
  
  // Detect current theme
  function detectTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'default';
  }
  
  onMount(() => {
    if (!content) {
      console.error('No Mermaid content provided');
      if (container) {
        container.innerHTML = '<pre class="error">No diagram content provided</pre>';
      }
      return;
    }
    
    // Use detected theme unless explicitly provided
    currentTheme = theme === 'default' ? detectTheme() : theme;
    
    // Listen for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      currentTheme = e.matches ? 'dark' : 'default';
      renderDiagram();
    };
    mediaQuery.addEventListener('change', handleThemeChange);
    
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        
        // Clear any existing content
        if (container) {
          container.innerHTML = '';
        }
        
        // Get CSS variable values from computed styles
        const computedStyle = getComputedStyle(document.documentElement);
        const getCSSVar = (varName) => computedStyle.getPropertyValue(varName).trim();
        
        mermaid.initialize({ 
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          themeVariables: {
            primaryColor: getCSSVar('--color-primary-500'),
            primaryTextColor: getCSSVar('--color-neutral-950'),
            primaryBorderColor: getCSSVar('--color-primary-600'),
            lineColor: getCSSVar('--color-neutral-400'),
            secondaryColor: getCSSVar('--color-primary-100'),
            tertiaryColor: getCSSVar('--color-neutral-100'),
            background: getCSSVar('--color-neutral-50'),
            mainBkg: getCSSVar('--color-primary-100'),
            secondBkg: getCSSVar('--color-neutral-100'),
            tertiaryBkg: getCSSVar('--color-neutral-200'),
            secondaryBorderColor: getCSSVar('--color-primary-400'),
            tertiaryBorderColor: getCSSVar('--color-primary-300'),
            textColor: getCSSVar('--color-neutral-950'),
            labelTextColor: getCSSVar('--color-neutral-950'),
            errorBkgColor: 'var(--color-error-bg, #fee)',
            errorTextColor: 'var(--color-error, #cc0000)'
          }
        });
        
        const { svg } = await mermaid.render(id, content);
        if (container) {
          container.innerHTML = svg;
          rendered = true;
        }
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        if (container) {
          container.innerHTML = `<pre class="error">Error: ${error.message}\n\nContent received:\n${content}</pre>`;
        }
      }
    };
    
    renderDiagram();
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  });
</script>

<div bind:this={container} class="mermaid-container" class:rendered>
  {#if !rendered}
    <pre>{content || 'Loading...'}</pre>
  {/if}
</div>

<style>
  .mermaid-container {
    width: 100%;
    text-align: center;
    margin: 2rem 0;
  }
  
  .mermaid-container :global(svg) {
    max-width: 100%;
    height: auto;
  }
  
  :global(.error) {
    color: var(--color-error, red);
    background: var(--color-error-bg, #fee);
    padding: 1rem;
    border-radius: 0.25rem;
  }
</style>