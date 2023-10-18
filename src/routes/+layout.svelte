<script>
  import "@shoelace-style/shoelace/dist/themes/light.css";
  import "@shoelace-style/shoelace/dist/themes/dark.css";
  import "$styles/app.css";
  import "$styles/shoelace.css";
  import Footer from "$lib/components/footer.svelte";
</script>

<slot />
<Footer />
