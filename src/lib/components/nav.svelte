<script>
  import { locale } from "$lib/i18n";
  import Ja from "$icons/openmoji/flag-ja.svg?raw";
  import Us from "$icons/openmoji/flag-us.svg?raw";
  import Vi from "$icons/openmoji/flag-vi.svg?raw";
  import Banana from "$icons/fluent/banana.svg?raw";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
</script>

<nav>
  <div role="group" class="square">
    <label small>
      <input bind:group={$locale} type="radio" name="language" value="en" />
      {@html Us}
    </label>
    <label small>
      <input bind:group={$locale} type="radio" name="language" value="ja" />
      {@html Ja}
    </label>
    <label small>
      <input bind:group={$locale} type="radio" name="language" value="vi" />
      {@html Vi}
    </label>
    <label small>
      <input bind:group={$locale} type="radio" name="language" value="mini" />
      {@html Banana}
    </label>
  </div>
  <ThemeSwitcher />
</nav>
