<script>
  import { onMount } from "svelte";
  import { locale } from "svelte-i18n";
  import FlagJP from "~icons/twemoji/flag-japan";
  import FlagEN from "~icons/twemoji/flag-united-kingdom";
  import FlagBanana from "~icons/twemoji/banana";
  import Switcher from "$lib/components/switcher3.svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
  let switcher;

  onMount(() => {
    switch ($locale) {
      case "en":
        switcher.userSelectA();
        break;
      case "ja":
        switcher.userSelectB();
        break;
      case "mini":
        switcher.userSelectC();
        break;
      default:
        switcher.userSelectA();
    }
  });
</script>

<nav>
  <Switcher
    id="switchLanguage"
    bind:this={switcher}
    on:change={(event) => {
      switch (event.detail.value) {
        case 0:
          locale.set("en");
          break;
        case 1:
          locale.set("ja");
          break;
        case 2:
          locale.set("mini");
          break;
        default:
          locale.set("en");
      }
    }}
  >
    <FlagEN slot="label-a" />
    <FlagJP slot="label-b" />
    <FlagBanana slot="label-c" />
  </Switcher>
  <ThemeSwitcher />
</nav>
