<script>
  import { createEventDispatcher } from "svelte";
  import {
    cellLabel,
    cellKind,
    notationFromCells,
    cellsFromNotation,
    PRESETS,
  } from "$lib/playgrounds/poker/range.js";

  export let notation = "";

  const dispatch = createEventDispatcher();

  let selected = cellsFromNotation(notation);
  let lastNotation = notation;

  $: if (notation !== lastNotation) {
    selected = cellsFromNotation(notation);
    lastNotation = notation;
  }

  let dragging = false;
  let dragMode = null;

  function setCell(i, mode) {
    if (mode === "add") selected.add(i);
    else selected.delete(i);
  }

  function startDrag(r, c, e) {
    e.preventDefault();
    const i = r * 13 + c;
    dragMode = selected.has(i) ? "remove" : "add";
    setCell(i, dragMode);
    dragging = true;
    selected = selected;
    syncNotation();
  }

  function continueDrag(r, c) {
    if (!dragging) return;
    setCell(r * 13 + c, dragMode);
    selected = selected;
    syncNotation();
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    dragMode = null;
  }

  function syncNotation() {
    notation = notationFromCells(selected);
    lastNotation = notation;
    dispatch("change", { notation });
  }

  function preset(name) {
    selected = PRESETS[name]();
    syncNotation();
  }
</script>

<svelte:window on:pointerup={endDrag} on:pointercancel={endDrag} />

<fieldset>
  <div role="toolbar" aria-label="Range presets">
    <button type="button" on:click={() => preset("any")}>Any</button>
    <button type="button" on:click={() => preset("premium")}>Premium</button>
    <button type="button" on:click={() => preset("broadway")}>Broadway</button>
    <button type="button" on:click={() => preset("pairs")}>Pairs</button>
    <button type="button" on:click={() => preset("suited_connectors")}>Connectors</button>
    <button type="button" class="clear" on:click={() => preset("clear")}>Clear</button>
  </div>

  <div class="grid" role="grid" aria-label="Range matrix">
    {#each Array(13) as _, r}
      {#each Array(13) as _, c}
        {@const sel = selected.has(r * 13 + c)}
        <button
          type="button"
          class={cellKind(r, c)}
          class:selected={sel}
          aria-label={cellLabel(r, c)}
          aria-pressed={sel}
          on:pointerdown={(e) => startDrag(r, c, e)}
          on:pointerenter={() => continueDrag(r, c)}
        >
          {cellLabel(r, c)}
        </button>
      {/each}
    {/each}
  </div>
</fieldset>

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  [role="toolbar"] {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem;
  }
  [role="toolbar"] button {
    background: #1f2937;
    color: #fff;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    border: 0;
    cursor: pointer;
  }
  [role="toolbar"] button.clear {
    background: #b91c1c;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(13, minmax(0, 1fr));
    gap: 2px;
    width: min(100%, 26rem);
    aspect-ratio: 1 / 1;
    user-select: none;
    touch-action: none;
  }
  .grid button {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1 / 1;
    border: 1px solid #d1d5db;
    background: #f9fafb;
    color: #111827;
    font-size: 0.55rem;
    font-weight: 700;
    padding: 0;
    cursor: pointer;
    transition: background-color 75ms;
  }
  .grid button.pair {
    background: #fef3c7;
  }
  .grid button.suited {
    background: #ecfdf5;
  }
  .grid button.offsuit {
    background: #f3f4f6;
  }
  .grid button.selected {
    background: #f97316;
    color: #fff;
    border-color: #c2410c;
  }
  .grid button.pair.selected {
    background: #ea580c;
  }
  .grid button.suited.selected {
    background: #16a34a;
  }
  .grid button.offsuit.selected {
    background: #2563eb;
  }
  @media (min-width: 480px) {
    .grid button {
      font-size: 0.7rem;
    }
  }
  @media (min-width: 768px) {
    .grid button {
      font-size: 0.85rem;
    }
  }
</style>
