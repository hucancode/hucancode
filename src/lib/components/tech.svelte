<script>
  import { onMount } from "svelte";
  onMount(async () => {
    await import("$shoelace/icon/icon");
    await import("$shoelace/tooltip/tooltip");
  });
  let techs = [
    {
      set: "logo",
      icon: "cpp",
      name: "C++",
    },
    {
      set: "logo",
      icon: "opengl",
      name: "Open GL",
    },
    {
      set: "logo",
      icon: "wgpu",
      name: "Web GPU",
    },
    {
      set: "logo",
      icon: "blender",
      name: "Blender",
    },
    {
      set: "si",
      icon: "ue",
      name: "Unreal Engine",
    },
    {
      set: "si",
      icon: "rust",
      name: "Rust",
    },
    {
      set: "logo",
      icon: "wa",
      name: "Web Assembly",
    },
    {
      set: "logo",
      icon: "surrealdb",
      name: "Surreal DB",
    },
    {
      set: "logo",
      icon: "svelte-icon",
      name: "Svelte",
    },
    {
      set: "logo",
      icon: "tailwind-icon",
      name: "Tailwind CSS",
    },
    {
      set: "logo",
      icon: "rx",
      name: "Reactive X",
    },
    {
      set: "logo",
      icon: "flutter",
      name: "Flutter",
    },
    {
      set: "logo",
      icon: "arch",
      name: "Arch Linux",
    },
    {
      set: "logo",
      icon: "vim",
      name: "Vim",
    },
    {
      set: "logo",
      icon: "docker-icon",
      name: "Docker",
    },
  ];
</script>

<ul>
  {#each techs as tech}
    <li>
      <sl-tooltip content={tech.name}>
        <sl-icon
          library={tech.set}
          name={tech.icon}
          label={tech.name}
        />
      </sl-tooltip>
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
  sl-icon {
    width: unset;
    transition-duration: 800ms;
    filter: contrast(90%) sepia(50%);
  }
  sl-icon:hover {
    filter: none;
  }
</style>
