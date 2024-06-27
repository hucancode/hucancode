<script>
    import { browser } from "$app/environment";
  import "$styles/app.css";
    import { onMount } from "svelte";
  // import Footer from "$lib/components/footer.svelte";
  const GTAG_ID = "G-FV5C3T8B5Y";
  onMount(() => {
    if(!browser) {
      return;
    }
    window.dataLayer = window.dataLayer || [];
    dataLayer.push(["js", new Date()]);
    dataLayer.push(["config", GTAG_ID]);
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;700&display=swap"
    rel="stylesheet"
  />
  <!-- Google tag (gtag.js) -->
  <script
    async
    src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`}
  ></script>
</svelte:head>

<slot />
