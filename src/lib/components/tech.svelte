<script>
  import { onMount } from "svelte";
  import Cpp from "$icons/logo/cpp.svg?raw";
  import OpenGL from "$icons/logo/opengl.svg?raw";
  import WebGPU from "$icons/logo/wgpu.svg?raw";
  import Blender from "$icons/logo/blender.svg?raw";
  import UnrealEngine from "$icons/simple-icons/ue.svg?raw";
  import Rust from "$icons/simple-icons/rust.svg?raw";
  import WebAssembly from "$icons/logo/wa.svg?raw";
  import SurrealDB from "$icons/logo/surrealdb.svg?raw";
  import Svelte from "$icons/logo/svelte-icon.svg?raw";
  import Tailwind from "$icons/logo/tailwind-icon.svg?raw";
  import ReactiveX from "$icons/logo/rx.svg?raw";
  import Flutter from "$icons/logo/flutter.svg?raw";
  import Arch from "$icons/logo/arch.svg?raw";
  import Vim from "$icons/logo/vim.svg?raw";
  import Docker from "$icons/logo/docker.svg?raw";
  let techs = [
    {
      icon: Cpp,
      name: "C++",
    },
    {
      icon: OpenGL,
      name: "Open GL",
    },
    {
      icon: WebGPU,
      name: "Web GPU",
    },
    {
      icon: Blender,
      name: "Blender",
    },
    {
      icon: UnrealEngine,
      name: "Unreal Engine",
    },
    {
      icon: Rust,
      name: "Rust",
    },
    {
      icon: WebAssembly,
      name: "Web Assembly",
    },
    {
      icon: SurrealDB,
      name: "Surreal DB",
    },
    {
      icon: Svelte,
      name: "Svelte",
    },
    {
      icon: Tailwind,
      name: "Tailwind CSS",
    },
    {
      icon: ReactiveX,
      name: "Reactive X",
    },
    {
      icon: Flutter,
      name: "Flutter",
    },
    {
      icon: Arch,
      name: "Arch Linux",
    },
    {
      icon: Vim,
      name: "Vim",
    },
    {
      icon: Docker,
      name: "Docker",
    },
  ];
</script>

<ul>
  {#each techs as tech}
    <li title={tech.name}>
      {@html tech.icon}
    </li>
  {/each}
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
    list-style-type: none;
    font-size: xx-large;
    gap: 1.25rem;
  }
  li {
    width: unset;
    transition-duration: 800ms;
    filter: contrast(90%) sepia(50%);
  }
  li:hover {
    filter: none;
  }
</style>
