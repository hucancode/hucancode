<script>
  import { locale } from "svelte-i18n";
  import Switcher from "$lib/components/switcher.svelte";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav
  class="flex h-16 w-full max-w-screen-lg flex-row items-center justify-between px-4 md:px-10"
>
  <Switcher
    id="switchLanguage"
    labelA="🇺🇸"
    labelB="🇯🇵"
    on:change={(event) => {
      if (event.detail.value) {
        locale.set("ja");
      } else {
        locale.set("en");
      }
    }}
  />
  <div
    class="flex h-12
        w-16
        cursor-pointer
        select-none
        items-center border-none
        bg-transparent
        outline-none"
  >
    <ThemeSwitcher />
  </div>
</nav>
