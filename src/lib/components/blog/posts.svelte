<script>
  import CreativeIcon from "~icons/icons8/idea";
  import MathIcon from "~icons/tabler/math";
  import ThreeDIcon from "~icons/ic/twotone-3d-rotation";
  import UEIcon from "~icons/fontisto/unreal-engine";
  import LeetcodeIcon from "~icons/simple-icons/leetcode";
  import CppIcon from "~icons/mdi/language-cpp";
  import ProgrammingIcon from "~icons/icon-park-twotone/computer";
  import FunctionIcon from "~icons/fluent/math-formula-16-filled";
  import GameIcon from "~icons/icon-park-twotone/game-ps";
  import DiceIcon from "~icons/fluent-emoji-high-contrast/game-die";
  import BookIcon from "~icons/heroicons/book-open-solid";
  import { formatDateRelative } from "$lib/i18n";
  import { onMount } from "svelte";
  export let posts = [];

  function convertDate(date) {
    return formatDateRelative('en', new Date(date));
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
        categories: ["cpp"],
        icon: CppIcon,
      },
      {
        categories: ["math", "geometry", "computational-geometry"],
        icon: MathIcon,
      },
      {
        categories: ["unreal", "game"],
        icon: GameIcon,
      },
      {
        categories: ["unreal"],
        icon: UEIcon,
      },
      {
        categories: ["3d"],
        icon: ThreeDIcon,
      },
      {
        categories: ["creative", "creative-coding"],
        icon: CreativeIcon,
      },
      {
        categories: ["book"],
        icon: BookIcon,
      },
    ];
    let ret = [];
    for (let item of data) {
      if (post.categories.some((cat) => item.categories.includes(cat))) {
        ret.push(item.icon);
        if (ret.length >= 5) break;
      }
    }
    return ret;
  }
</script>

<ul>
  {#each posts as post}
    <li>
      <div class="cover">
      <img
        alt="thumbnail"
        src={post.cover}
      />
      <div class="tag-container">
        {#each getIcons(post) as icon}
          <svelte:component this={icon} class="bg-black p-2" />
        {/each}
      </div>
      </div>
      <article>
        <a data-sveltekit:prefetch href="/blog/post/{post.slug}">
          <h2
          >
            {post.title}
          </h2>
          <time
            >Posted {convertDate(post.date)}</time
          >
        </a>
        <summary
          >{post.excerpt}</summary
        >
      </article>
    </li>
  {/each}
</ul>

<style>
  ul {
    max-width: 768px;
    flex-grow: 1;
  }
  li {
    display: flex;
    margin-bottom: 0.5rem;
    gap: 0.5rem;
    padding: 1rem;
    flex-direction: column;
  }
  @media (min-width: 768px) {
    li {
      flex-direction: row;
    }
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;
  }
  @media (min-width: 640px) {
    .cover {
      width: 25%;
    }
  }
  .tag-container {
    position: absolute;
    max-width: 100%;
    left: 0;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    padding: 0.25rem;
    background-color: var(--sl-color-neutral-200);
  }
  article {
    width: 100%;
  }
  summary {
    color: var(--sl-color-neutral-300);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
  time {
    color: var(--sl-color-neutral-400);
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>