<script>
  import CPP from "~icons/simple-icons/cplusplus";
  import OpenGL from "~icons/simple-icons/opengl";
  import Blender from "~icons/simple-icons/blender";
  import UnrealEngine from "~icons/simple-icons/unrealengine";
  import React from "~icons/simple-icons/react";
  import Next from "~icons/simple-icons/nextdotjs";
  import Nest from "~icons/simple-icons/nestjs";
  import Flutter from "~icons/simple-icons/flutter";
  import MySQL from "~icons/simple-icons/mysql";
  import GraphQL from "~icons/simple-icons/graphql";
  import Docker from "~icons/simple-icons/docker";
  import Arch from "~icons/simple-icons/archlinux";
  import Vim from "~icons/simple-icons/vim";
  import Fastlane from "~icons/simple-icons/fastlane";
  import Github from "~icons/simple-icons/github";
  import RX from "~icons/simple-icons/reactivex";
  import GCP from "~icons/simple-icons/googlecloud";
  import Tailwind from "~icons/simple-icons/tailwindcss";
  import Svelte from "~icons/simple-icons/svelte";
  import Leetcode from "~icons/simple-icons/leetcode";
  import FlagJP from "~icons/twemoji/flag-japan";
  import FlagEN from "~icons/twemoji/flag-united-kingdom";
  import WavingHand from "~icons/twemoji/waving-hand";
</script>

<ul>
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
    <React />
    <span>React</span>
  </li>
  <li>
    <Next />
    <span>NextJS</span>
  </li>
  <li>
    <Nest />
    <span>NestJS</span>
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
    <MySQL />
    <span>MySQL</span>
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
    <Fastlane />
    <span>Fastlane</span>
  </li>
  <li>
    <Github />
    <span>Github</span>
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
  ul {
    @apply flex flex-wrap w-full
    max-w-screen-lg items-center justify-center
    overflow-hidden py-4 px-6
    text-center;
  }
  li {
    @apply m-3 flex text-4xl
                h-16 w-14 flex-col
                items-center;
    @apply text-gray-700 dark:text-gray-100;
  }
  span {
    @apply w-24 mt-2 text-center text-xs;
  }
</style>
