<script>
  import { onMount } from "svelte";
  onMount(async () => {
    await import("@shoelace-style/shoelace/dist/components/icon/icon");
  });
</script>

<ul>
  <li>
    <sl-icon library="si" name="cpp" />
    <span>C++</span>
  </li>
  <li>
    <sl-icon library="si" name="opengl" />
    <span>OpenGL</span>
  </li>
  <li>
    <sl-icon library="si" name="blender" />
    <span>Blender</span>
  </li>
  <li>
    <sl-icon library="si" name="ue" />
    <span>Unreal Engine</span>
  </li>
  <li>
    <sl-icon library="si" name="rust" />
    <span>Rust</span>
  </li>
  <li>
    <sl-icon library="si" name="svelte" />
    <span>Svelte</span>
  </li>
  <li>
    <sl-icon library="si" name="tailwind" />
    <span>Tailwind</span>
  </li>
  <li>
    <sl-icon library="si" name="rx" />
    <span>Rx</span>
  </li>
  <li>
    <sl-icon library="si" name="flutter" />
    <span>Flutter</span>
  </li>
  <li>
    <sl-icon library="si" name="arch" />
    <span>Arch Linux</span>
  </li>
  <li>
    <sl-icon library="si" name="vim" />
    <span>Vim</span>
  </li>
  <li>
    <sl-icon library="si" name="docker" />
    <span>Docker</span>
  </li>
</ul>

<style>
  ul {
    display: flex;
    width: 100%;
    max-width: 640px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    text-align: center;
  }
  li {
    margin: 0.75rem;
    display: flex;
    height: 4rem;
    width: 3.5rem;
    flex-direction: column;
    align-items: center;
    font-size: 2.25rem;
    line-height: 2.5rem;
  }
  span {
    margin-top: 0.5rem;
    width: 6rem;
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
