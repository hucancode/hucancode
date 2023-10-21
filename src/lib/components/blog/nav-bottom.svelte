<script>
  import GoBack from "$icons/line-md/chevron-left.svg?raw";
  import BuyMeACoffee from "$icons/line-md/buy-me-a-coffee.svg?raw";
</script>

<nav>
  <a href="/blog"
    ><h2 rainbow>
      {@html GoBack}
      Return to blog
    </h2></a
  >
  <a
    target="_blank"
    rel="noreferrer"
    href="https://www.buymeacoffee.com/hucancode"
    ><h2 rainbow="0">
      Buy me a coffee
      {@html BuyMeACoffee}
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
</style>
