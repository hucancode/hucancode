<script>
  import { onMount } from 'svelte';
  import Prism from 'prismjs';
  import 'prismjs/components/prism-c';
  import 'prismjs/components/prism-cpp';
  import 'prismjs/components/prism-javascript';
  import 'prismjs/components/prism-typescript';
  import 'prismjs/components/prism-jsx';
  import 'prismjs/components/prism-tsx';
  import 'prismjs/components/prism-css';
  import 'prismjs/components/prism-python';
  import 'prismjs/components/prism-rust';
  import 'prismjs/components/prism-bash';
  import 'prismjs/components/prism-json';
  import 'prismjs/components/prism-markdown';
  
  /** @type {{ content: string, language?: string, filename?: string, showLineNumbers?: boolean, highlightLines?: string, inline?: boolean }} */
  let { content, language = 'text', filename, showLineNumbers = false, highlightLines, inline = false } = $props();
  
  let codeElement = $state();
  let highlightedLines = $derived(highlightLines ? parseHighlightLines(highlightLines) : new Set());
  
  function parseHighlightLines(lines) {
    const result = new Set();
    const parts = lines.split(',');
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        for (let i = start; i <= end; i++) {
          result.add(i);
        }
      } else {
        result.add(parseInt(part.trim()));
      }
    });
    
    return result;
  }
  
  onMount(() => {
    if (codeElement && language !== 'text' && !inline) {
      Prism.highlightElement(codeElement);
    }
  });
</script>

{#if inline}
  <code class="inline-code">{content}</code>
{:else}
  <div class="code-block">
    {#if filename}
      <div class="code-filename">{filename}</div>
    {/if}
    <pre class="language-{language}" class:line-numbers={showLineNumbers}><code bind:this={codeElement} class="language-{language}">{#if showLineNumbers}{#each content.split('\n') as line, i}<span class="line" class:highlighted={highlightedLines.has(i + 1)}>{line}
</span>{/each}{:else}{content}{/if}</code></pre>
  </div>
{/if}

<style>
  .code-block {
    margin: 1.5rem 0;
    border-radius: 0.5rem;
    overflow: hidden;
    background: var(--color-code-bg, #1e1e1e);
  }
  
  .code-filename {
    padding: 0.5rem 1rem;
    background: var(--color-code-header-bg, #2d2d2d);
    color: var(--color-code-header-text, #ccc);
    font-size: 0.875rem;
    font-family: monospace;
    border-bottom: 1px solid var(--color-code-border, #444);
  }
  
  pre {
    margin: 0;
    padding: 1rem;
    overflow-x: auto;
  }
  
  pre.line-numbers {
    padding-left: 3.5rem;
    position: relative;
    counter-reset: line;
  }
  
  .line {
    display: block;
    position: relative;
  }
  
  .line::before {
    counter-increment: line;
    content: counter(line);
    position: absolute;
    left: -3rem;
    width: 2.5rem;
    text-align: right;
    color: var(--color-code-line-number, #666);
    user-select: none;
  }
  
  .line.highlighted {
    background: var(--color-code-highlight, rgba(255, 255, 255, 0.1));
    margin: 0 -1rem;
    padding: 0 1rem;
  }
  
  code {
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  }
  
  .inline-code {
    background: var(--color-neutral-200);
    color: var(--color-neutral-950);
    padding: 0.2em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
  
  :global(.dark) .inline-code {
    background: var(--color-neutral-800);
    color: var(--color-neutral-50);
  }
</style>