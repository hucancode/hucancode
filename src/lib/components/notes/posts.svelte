<script>
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

  /**
   * @typedef {Object} Props
   * @property {any} [posts]
   */

  /** @type {Props} */
  let { posts = [], base = "/notes" } = $props();

  function getIcons(post) {
    const data = [
      { categories: ["combinatorics"], icon: GameDie },
      { categories: ["dynamic-programming"], icon: Function },
      { categories: ["leetcode"], icon: Leetcode },
      { categories: ["cpp"], icon: Cpp },
      { categories: ["math", "geometry", "computational-geometry"], icon: Calculate },
      { categories: ["unreal", "game"], icon: VideoGame },
      { categories: ["unreal"], icon: UnrealEngine },
      { categories: ["3d"], icon: ThreeD },
      { categories: ["creative", "creative-coding"], icon: Lightbulb },
      { categories: ["book"], icon: Book },
    ];
    const ret = [];
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
      <a href="{base}/post/{post.slug}">
        <span>
          {#each getIcons(post) as icon}
            {@html icon}
          {/each}
        </span>
        <h3>{post.title}</h3>
      </a>
    </li>
  {/each}
</ul>

<style>
  ul {
    padding-left: 0;
    list-style: none;
    margin: 0 auto;
  }
  li {
    border-bottom: 1px solid color-mix(in srgb, var(--ink) 15%, transparent);
  }
  li a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 0.5rem;
    text-decoration: none;
    color: inherit;
  }
  li a:hover h3 {
    color: var(--link);
  }
  a span {
    display: inline-flex;
    flex-shrink: 0;
    gap: 0.2rem;
    opacity: 0.7;
  }
  a span :global(svg) {
    height: 1.3em;
    width: 1.3em;
  }
  h3 {
    font-size: 1.05rem;
  }
</style>
