<script>
  // A control list for a mech params/pose object: `ctl` is [key, label, min,
  // max, step?] rows, `values` the $state object they write into (mutated in
  // place). A 0/1 row with step 1 renders as a checkbox — the flag params
  // (solid male, disc caps) read better that way than a two-stop slider.
  let { ctl, values } = $props();
</script>

{#each ctl as [key, label, min, max, step]}
  {#if min === 0 && max === 1 && step === 1}
    <label><input type="checkbox" checked={!!values[key]}
      onchange={(e) => (values[key] = e.currentTarget.checked ? 1 : 0)} /><span>{label}</span></label>
  {:else}
    <label><span>{label}</span>
      <input type="range" {min} {max} step={step ?? 0.01} value={values[key]}
        oninput={(e) => (values[key] = +e.currentTarget.value)} />
      <output>{values[key].toFixed(step && step >= 1 ? 0 : 2)}</output></label>
  {/if}
{/each}
