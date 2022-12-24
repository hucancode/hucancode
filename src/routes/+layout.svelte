<script>
  import "$styles/app.css";
  import { webVitals } from "$lib/vitals";
  import { browser } from "$app/environment";
  import { page } from "$app/stores";

  let analyticsId = import.meta.env.VERCEL_ANALYTICS_ID;
  $: if (browser && analyticsId) {
    webVitals({
      path: $page.url.pathname,
      params: $page.params,
      analyticsId,
    });
  }
</script>

<slot />
