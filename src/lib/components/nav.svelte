<script>
  import { page } from "$app/state";
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
  {#each links as { href, label }}
    <a {href} aria-current={active(href) ? "page" : undefined}>{label}</a>
  {/each}
</nav>
