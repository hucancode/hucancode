<script>
  import { createEventDispatcher } from "svelte";
  import * as poker from "$lib/playgrounds/poker/cards.js";

  /** 0..51 card id, or -1 for an empty slot */
  export let card = 0;
  /** card is spoken for elsewhere on the board: draw it hatched, block picking */
  export let used = false;
  /** render as a <label> wrapping a checkbox instead of an inert <span> */
  export let selectable = false;
  export let selected = false;

  const dispatch = createEventDispatcher();

  $: rankIdx = Math.floor(card / 4);
  $: suitIdx = card % 4;
  $: court =
    card >= 0 && rankIdx >= 9 && rankIdx <= 11 ? poker.cardIdToText(card) : "";
  $: blank = used || card < 0;
</script>

<!-- styles live in $styles/poker.css, keyed off [data-card] -->
<svelte:element
  this={selectable ? "label" : "span"}
  data-card
  data-high={card >= 9 * 4 || null}
>
  {#if selectable}
    <input
      type="checkbox"
      checked={selected}
      disabled={used}
      on:change={() => dispatch("selectedChange", { selected: !selected })}
    />
  {/if}
  <span data-suit={poker.suitSymbols[suitIdx] ?? null} data-blank={blank || null}>
    <b>{poker.readableRanks[rankIdx] ?? ""}</b>
    {#if court}
      <img src="/courts/{court}.svg" alt={court} draggable="false" />
    {:else}
      <i>{poker.suitSymbols[suitIdx] ?? ""}</i>
    {/if}
  </span>
</svelte:element>
