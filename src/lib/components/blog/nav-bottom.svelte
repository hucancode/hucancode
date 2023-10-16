<script>
  import GoBack from "~icons/ri/arrow-left-line";
  import Coffee from "~icons/simple-icons/buymeacoffee";
</script>

<small> That's all! Thank you for reading all the way here 😊 </small>
<nav>
  <a data-sveltekit:prefetch href="/blog"
    ><h2 rainbow>
      <GoBack />
      Return to blog
    </h2></a
  >
  <a
    target="_blank"
    rel="noreferrer"
    href="https://www.buymeacoffee.com/hucancode"
    ><h2 rainbow="0">
      Buy me a coffee
      <Coffee />
    </h2></a
  >
</nav>

<style>
  small {
    margin-left: 1rem;
    margin-right: 1rem;
    text-align: center;
  }
  nav {
    margin-bottom: 2.5rem;
  }
  h2 {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  h2 :global(svg) {
    color: var(--sl-color-primary-700);
  }
</style>
