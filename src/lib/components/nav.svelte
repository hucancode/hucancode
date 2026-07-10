<script>
  import { page } from "$app/state";

  /**
   * @typedef {Object} Props
   * @property {string} [current] force which link is marked, for pages whose
   *   path doesn't sit under it (playgrounds live at /dragon, /rubik, ...)
   */

  /** @type {Props} */
  let { current } = $props();

  const links = [
    { href: "/", label: "Home" },
    { href: "/notes", label: "Notes" },
    { href: "/playgrounds", label: "Playgrounds" },
  ];

  const active = (href) => {
    if (current) return href === current;
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  };
</script>

<nav>
  <div>
    {#each links as { href, label }}
      <a {href} aria-current={active(href) ? "page" : undefined}>{label}</a>
    {/each}
  </div>
</nav>

<style>
  div {
    display: flex;
    gap: 1rem;
  }

  a[aria-current="page"] {
    text-decoration: underline;
    text-underline-offset: 0.3em;
  }
</style>
