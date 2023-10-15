<script>
  import GoBack from "~icons/ri/arrow-left-line";
  import Coffee from "~icons/simple-icons/buymeacoffee";
</script>

<small> That's all! Thank you for reading all the way here 😊 </small>
<nav>
  <h2 rainbow>
    <GoBack />
    <a data-sveltekit:prefetch href="/blog">Return to blog</a>
  </h2>
  <h2 rainbow>
    <a
      target="_blank"
      rel="noreferrer"
      href="https://www.buymeacoffee.com/hucancode">Buy me a coffee</a
    >
    <Coffee />
  </h2>
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
</style>
