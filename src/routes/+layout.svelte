<script>
  import "$lib/styles/app.css";
  import { webVitals } from '$lib/vitals';
  import { inject } from '@vercel/analytics';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  let analyticsId = import.meta.env.VERCEL_ANALYTICS_ID;
  $: if (browser && analyticsId) {
    inject();
    webVitals({
      path: $page.url.pathname,
      params: $page.params,
      analyticsId
    })
  }
</script>

<svelte:head>
  <title>hucancode</title>
</svelte:head>
<slot />
