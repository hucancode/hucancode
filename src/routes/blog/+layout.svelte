<script>
  import Nav from "$lib/components/blog/nav.svelte";
  import Footer from "$lib/components/blog/footer.svelte";
  import "$styles/tailwind.css";
</script>

<Nav />
<slot />
<Footer />
