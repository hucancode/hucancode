<script>
  import { onMount } from "svelte";
  import { locale } from "$lib/i18n";
  import ThemeSwitcher from "$lib/components/theme-switcher.svelte";
  onMount(async () => {
    await import("$shoelace/radio-button/radio-button");
    await import("$shoelace/radio-group/radio-group");
  });
</script>

<nav>
  <sl-radio-group
    name="language"
    value={$locale}
    on:sl-change={(e) => ($locale = e.target.value)}
  >
    <sl-radio-button value="en">
      <sl-icon name="gb-flag" library="fx" label="English" />
    </sl-radio-button>
    <sl-radio-button value="ja">
      <sl-icon name="jp-flag" library="fx" label="Japanese" />
    </sl-radio-button>
    <sl-radio-button value="mini">
      <sl-icon name="banana" library="fx" label="Minionese" />
    </sl-radio-button>
  </sl-radio-group>
  <ThemeSwitcher />
</nav>
