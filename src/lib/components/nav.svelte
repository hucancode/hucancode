<script>
  import { locale } from "svelte-i18n";
  import FlagJP from "~icons/twemoji/flag-japan";
  import FlagEN from "~icons/twemoji/flag-united-kingdom";
  import Switcher from "$lib/components/switcher.svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <Switcher
    id="switchLanguage"
    on:change={(event) => {
      if (event.detail.value) {
        locale.set("ja");
      } else {
        locale.set("en");
      }
    }}
  >
    <FlagEN slot="label-a" />
    <FlagJP slot="label-b" />
  </Switcher>
    <ThemeSwitcher />
</nav>
