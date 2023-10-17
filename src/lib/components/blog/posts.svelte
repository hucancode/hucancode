<script>
  import { onMount } from "svelte";
  import { formatDateRelative } from "$lib/i18n";
  export let posts = [];

  function convertDate(date) {
    return formatDateRelative("en", new Date(date));
  }
  function getIcons(post) {
    let data = [
      {
        categories: ["combinatorics"],
        iconSet: "fluent",
        icon: "game-die",
      },
      {
        categories: ["dynamic-programming"],
        iconSet: "material",
        icon: "function",
      },
      {
        categories: ["leetcode"],
        iconSet: "si",
        icon: "leetcode",
      },
      {
        categories: ["cpp"],
        iconSet: "si",
        icon: "cpp",
      },
      {
        categories: ["math", "geometry", "computational-geometry"],
        iconSet: "material",
        icon: "calculate",
      },
      {
        categories: ["unreal", "game"],
        iconSet: "material",
        icon: "video-game",
      },
      {
        categories: ["unreal"],
        iconSet: "si",
        icon: "ue",
      },
      {
        categories: ["3d"],
        iconSet: "material",
        icon: "3d-rotation",
      },
      {
        categories: ["creative", "creative-coding"],
        iconSet: "material",
        icon: "lightbulb",
      },
      {
        categories: ["book"],
        iconSet: "material",
        icon: "menu-book",
      },
    ];
    let ret = [];
    for (let item of data) {
      if (post.categories.some((cat) => item.categories.includes(cat))) {
        ret.push({ icon: item.icon, set: item.iconSet });
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
        <div class="tag-container">
          {#each getIcons(post) as icon}
            <sl-icon name={icon.icon} library={icon.set} />
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
  .tag-container {
    position: absolute;
    max-width: 100%;
    left: 0;
    top: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.25rem;
    background-color: var(--sl-color-neutral-200);
  }
  header {
    width: 100%;
  }
  summary {
    color: var(--sl-color-neutral-600);
    font-size: small;
  }
  time {
    color: var(--sl-color-neutral-400);
    font-size: small;
  }
</style>
