<script>
  import { onMount } from "svelte";
  import { formatDateRelative } from "$lib/i18n";
  import GameDie from "$icons/fluent/game-die.svg?raw";
  import Function from "$icons/google-material/function.svg?raw";
  import Leetcode from "$icons/simple-icons/leetcode.svg?raw";
  import Cpp from "$icons/simple-icons/cpp.svg?raw";
  import Calculate from "$icons/google-material/calculate.svg?raw";
  import VideoGame from "$icons/google-material/video-game.svg?raw";
  import UnrealEngine from "$icons/simple-icons/ue.svg?raw";
  import ThreeD from "$icons/google-material/3d-rotation.svg?raw";
  import Lightbulb from "$icons/google-material/lightbulb.svg?raw";
  import Book from "$icons/google-material/menu-book.svg?raw";

  export let posts = [];

  function convertDate(date) {
    return formatDateRelative("en", new Date(date));
  }
  function getIcons(post) {
    let data = [
      {
        categories: ["combinatorics"],
        icon: GameDie,
      },
      {
        categories: ["dynamic-programming"],
        icon: Function,
      },
      {
        categories: ["leetcode"],
        icon: Leetcode,
      },
      {
        categories: ["cpp"],
        icon: Cpp,
      },
      {
        categories: ["math", "geometry", "computational-geometry"],
        icon: Calculate,
      },
      {
        categories: ["unreal", "game"],
        icon: VideoGame,
      },
      {
        categories: ["unreal"],
        icon: UnrealEngine,
      },
      {
        categories: ["3d"],
        icon: ThreeD,
      },
      {
        categories: ["creative", "creative-coding"],
        icon: Lightbulb,
      },
      {
        categories: ["book"],
        icon: Book,
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
        <img alt="thumbnail" src={post.cover} />
        <div role="container">
          {#each getIcons(post) as icon}
            {@html icon}
          {/each}
        </div>
      </div>
      <header>
        <a data-sveltekit:prefetch href="/blog/post/{post.slug}">
          <h3>
            {post.title}
          </h3>
          <time>Posted {convertDate(post.date)}</time>
        </a>
        <summary>{post.excerpt}</summary>
      </header>
    </li>
  {/each}
</ul>

<style>
  ul {
    max-width: 768px;
    flex-grow: 1;
    padding-left: 0;
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
    max-height: 10rem;
  }
  @media (min-width: 640px) {
    .cover {
      width: 25%;
    }
  }
  div[role="container"]:empty {
    display: none;
  }
  div[role="container"] {
    position: absolute;
    max-width: 100%;
    left: 0;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
    padding: 0.2rem;
    background-color: var(--color-neutral-200);
  }
  div[role="container"] :global(svg) {
    height: 1.5em;
  }
  header {
    width: 100%;
  }
  summary {
    color: var(--color-neutral-600);
    font-size: small;
  }
  time {
    color: var(--color-neutral-400);
    font-size: small;
  }
</style>
