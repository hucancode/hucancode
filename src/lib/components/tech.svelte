<script>
  import CPP from "~icons/simple-icons/cplusplus";
  import OpenGL from "~icons/simple-icons/opengl";
  import Blender from "~icons/simple-icons/blender";
  import UnrealEngine from "~icons/simple-icons/unrealengine";
  import Flutter from "~icons/simple-icons/flutter";
  import GraphQL from "~icons/simple-icons/graphql";
  import Docker from "~icons/simple-icons/docker";
  import Arch from "~icons/simple-icons/archlinux";
  import Vim from "~icons/simple-icons/vim";
  import RX from "~icons/simple-icons/reactivex";
  import GCP from "~icons/simple-icons/googlecloud";
  import Tailwind from "~icons/simple-icons/tailwindcss";
  import Svelte from "~icons/simple-icons/svelte";
</script>

<ul
  class="flex w-full max-w-screen-sm flex-wrap
    items-center justify-center p-5
    text-center text-gray-700 dark:text-gray-300 lg:w-1/2"
>
  <li>
    <CPP />
    <span>CPP</span>
  </li>
  <li>
    <OpenGL />
    <span>OpenGL</span>
  </li>
  <li>
    <Blender />
    <span>Blender</span>
  </li>
  <li>
    <UnrealEngine />
    <span>Unreal Engine</span>
  </li>
  <li>
    <Tailwind />
    <span>Tailwind</span>
  </li>
  <li>
    <Svelte />
    <span>Svelte</span>
  </li>
  <li>
    <RX />
    <span>RX</span>
  </li>
  <li>
    <Flutter />
    <span>Flutter</span>
  </li>
  <li>
    <Arch />
    <span>Arch Linux</span>
  </li>
  <li>
    <Vim />
    <span>Vim</span>
  </li>
  <li>
    <GCP />
    <span>GCP</span>
  </li>
  <li>
    <Docker />
    <span>Docker</span>
  </li>
</ul>

<style>
  li {
    @apply m-3 flex h-16
                w-14 flex-col items-center
                text-4xl;
  }
  span {
    @apply mt-2 w-24 text-center text-xs;
  }
</style>
