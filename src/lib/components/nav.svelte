<script>
  import { onMount } from "svelte";
  import { locale } from "$lib/i18n";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
  onMount(async () => {
    await import(
      "@shoelace-style/shoelace/dist/components/radio-button/radio-button"
    );
    await import(
      "@shoelace-style/shoelace/dist/components/radio-group/radio-group"
    );
  });
</script>

<nav>
  <sl-radio-group
    name="language"
    value={$locale}
    on:sl-change={(e) => ($locale = e.target.value)}
  >
    <sl-radio-button value="en">
      <sl-icon name="apple" label="English" />
    </sl-radio-button>
    <sl-radio-button value="ja">
      <sl-icon name="nintendo-switch" label="Japanese" />
    </sl-radio-button>
    <sl-radio-button value="mini">
      <sl-icon name="rocket-takeoff" label="Minionese" />
    </sl-radio-button>
  </sl-radio-group>
  <ThemeSwitcher />
</nav>
