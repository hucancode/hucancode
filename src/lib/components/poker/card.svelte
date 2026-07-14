<script>
  import { createEventDispatcher } from "svelte";
  import * as poker from "$lib/playgrounds/poker/cards.js";
  export let card = 0;
  export let used = false;
  export let selectable = false;
  export let selected = false;

  $: rankIdx = Math.floor(card / 4);
  $: suitIdx = card % 4;
  $: isHigh = card >= 9 * 4;
  $: isRed = suitIdx >= 2;
  $: isCourt = card >= 0 && rankIdx >= 9 && rankIdx <= 11;
  $: courtCid = isCourt ? poker.cardIdToText(card) : "";
  $: blank = used || card < 0;

  const dispatch = createEventDispatcher();
</script>

<svelte:element
  this={selectable ? "label" : "span"}
  class="card"
  class:is-high={isHigh}
>
  {#if selectable}
    <input
      type="checkbox"
      checked={selected}
      disabled={used}
      on:change={() => dispatch("selectedChange", { selected: !selected })}
    />
  {/if}
  <span class="face" class:selected class:is-red={isRed} class:blank>
    <b>{poker.readableRanks[rankIdx] ?? ""}</b>
    {#if isCourt}
      <img src="/courts/{courtCid}.svg" alt={courtCid} draggable="false" />
    {:else}
      <i>{poker.suitSymbols[suitIdx] ?? ""}</i>
    {/if}
  </span>
</svelte:element>

<style>
  .card {
    display: block;
    aspect-ratio: 2 / 2.5;
    width: 3.5rem;
    border-radius: 0.275rem;
    padding: 0.075rem;
    background-color: #e5e7eb;
  }
  @media (min-width: 512px) {
    .card {
      width: 4rem;
      border-radius: 0.375rem;
      padding: 0.125rem;
    }
  }
  input {
    display: none;
  }
  .face {
    position: relative;
    display: flex;
    height: 100%;
    width: 100%;
    user-select: none;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    background-color: #f3f4f6;
    color: #1f2937;
    transition: background-color 150ms, transform 150ms;
  }
  .face.selected {
    background-color: #fed7aa;
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .face.is-red {
    color: #ef4444;
  }
  .face.blank::after {
    position: absolute;
    inset: 0;
    content: "";
    color: rgba(0, 0, 0, 0.8);
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      currentColor 10px,
      currentColor 20px
    );
  }
  .face b {
    position: absolute;
    top: 0.25rem;
    left: 0.25rem;
    line-height: 1;
    z-index: 1;
    font-weight: bolder;
  }
  .face i {
    font-size: 1.5rem;
    font-style: normal;
  }
  @media (min-width: 768px) {
    .face i {
      font-size: 2.25rem;
    }
  }
  .face img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  .card.is-high {
    position: relative;
    overflow: hidden;
    isolation: isolate;
    background-color: transparent;
  }
  .card.is-high::before {
    position: absolute;
    z-index: -10;
    animation: rotate 4s linear infinite;
    filter: blur(8px);
    content: "";
    left: -50%;
    top: -50%;
    width: 200%;
    height: 200%;
    background-repeat: no-repeat;
    background-size: 50% 50%, 50% 50%;
    background-position: 0 0, 100% 0, 100% 100%, 0 100%;
    background-image: linear-gradient(#399953, #399953),
      linear-gradient(#fbb300, #fbb300), linear-gradient(#d53e33, #d53e33),
      linear-gradient(#377af5, #377af5);
  }
  @keyframes rotate {
    to {
      transform: rotate(360deg);
    }
  }
</style>
