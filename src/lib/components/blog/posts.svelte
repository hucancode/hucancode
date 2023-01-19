<script>
  import MathIcon from "~icons/tabler/math";
  import LeetcodeIcon from "~icons/simple-icons/leetcode";
  import CppIcon from "~icons/mdi/language-cpp";
  import ProgrammingIcon from "~icons/icon-park-twotone/computer";
  import FunctionIcon from "~icons/fluent/math-formula-16-filled";
  import GameIcon from "~icons/icon-park-twotone/game-ps";
  import DiceIcon from "~icons/fluent-emoji-high-contrast/game-die";
  import { parseISO, formatRelative } from "date-fns";
  import { onMount } from "svelte";
  export let posts = [];
  function convertDate(date) {
    return formatRelative(parseISO(date), new Date());
  }
  function getIcons(post) {
    let data = [
      {
        categories: ["combinatorics"],
        icon: DiceIcon,
      },
      {
        categories: ["dynamic-programming"],
        icon: FunctionIcon,
      },
      {
        categories: ["leetcode"],
        icon: LeetcodeIcon,
      },
      {
        categories: ["c++"],
        icon: CppIcon,
      },
      {
        categories: ["math"],
        icon: MathIcon,
      },
      {
        categories: ["unreal", "game"],
        icon: GameIcon,
      },
    ];
    let ret = [];
    for (let item of data) {
      if (post.categories.some((cat) => item.categories.includes(cat))) {
        ret.push(item.icon);
      }
    }
    return ret;
  }
</script>

<ul class="max-w-screen-md grow">
  {#each posts as post}
    <li class="relative mb-2 flex flex-col gap-2 p-4 sm:flex-row">
      <img
        class="aspect-video w-full object-cover sm:w-1/4"
        alt="thumbnail"
        src={post.cover}
      />
      <div
        class="absolute top-4 left-4 flex flex-row flex-wrap bg-black text-3xl text-white"
      >
        {#each getIcons(post) as icon}
          <svelte:component this={icon} class="p-2" />
        {/each}
      </div>
      <article>
        <a data-sveltekit:prefetch href="/blog/post/{post.slug}">
          <h2
            class="flex gap-2 text-xl font-semibold hover:text-blue-800 hover:dark:text-sky-400"
          >
            {post.title}
          </h2>
          <small class="text-gray-400 dark:text-gray-600"
            >Posted {convertDate(post.date)}</small
          >
        </a>
        <p class="text-sm text-gray-600 dark:text-gray-400">{post.excerpt}</p>
      </article>
    </li>
  {/each}
</ul>
