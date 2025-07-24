<script>
  import Renderer from './renderer.svelte';
  import MermaidRenderer from './renderers/MermaidRenderer.svelte';
  import ComponentRenderer from './renderers/ComponentRenderer.svelte';
  import DragonRenderer from './renderers/DragonRenderer.svelte';
  import RubikRenderer from './renderers/RubikRenderer.svelte';
  import TaijiRenderer from './renderers/TaijiRenderer.svelte';
  import LegoRenderer from './renderers/LegoRenderer.svelte';
  import CalloutRenderer from './renderers/CalloutRenderer.svelte';
  import AccordionRenderer from './renderers/AccordionRenderer.svelte';
  import CodeRenderer from './renderers/CodeRenderer.svelte';
  import MathRenderer from './renderers/MathRenderer.svelte';
  import VideoRenderer from './renderers/VideoRenderer.svelte';
  
  /** @type {{ children: any }} */
  let { children } = $props();

  const components = {
    Mermaid: MermaidRenderer,
    Component: ComponentRenderer,
    Dragon: DragonRenderer,
    Rubik: RubikRenderer,
    Taiji: TaijiRenderer,
    Lego: LegoRenderer,
    Callout: CalloutRenderer,
    Accordion: AccordionRenderer,
    Code: CodeRenderer,
    Math: MathRenderer,
    Video: VideoRenderer,
  };
</script>

{#each children || [] as child}
  {#if typeof child === 'string'}
    {child}
  {:else if components[child.name]}
    {@const Component = components[child.name]}
    <Component {...child.attributes} children={child.children}>
      {#if child.children}
        {#each child.children as subchild}
          {#if typeof subchild === 'string'}
            {subchild}
          {:else}
            <Renderer children={[subchild]} />
          {/if}
        {/each}
      {/if}
    </Component>
  {:else if child.name}
    {@const isVoidElement = ['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(child.name)}
    {#if isVoidElement}
      <svelte:element this={child.name} {...child.attributes} />
    {:else}
      <svelte:element this={child.name} {...child.attributes}>
        {#if child.children}
          <Renderer children={child.children} />
        {/if}
      </svelte:element>
    {/if}
  {/if}
{/each}