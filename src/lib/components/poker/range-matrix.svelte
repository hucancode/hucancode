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
  const PRESET_LABELS = [
    ["any", "Any"],
    ["premium", "Premium"],
    ["broadway", "Broadway"],
    ["pairs", "Pairs"],
    ["suited_connectors", "Connectors"],
    ["clear", "Clear"],
  ];

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

<menu>
  {#each PRESET_LABELS as [name, label] (name)}
    <li>
      <button
        type="button"
        data-danger={name === "clear" || null}
        on:click={() => preset(name)}>{label}</button
      >
    </li>
  {/each}
</menu>

<fieldset aria-label="Range matrix">
  {#each Array(13) as _, r}
    {#each Array(13) as _, c}
      {@const sel = selected.has(r * 13 + c)}
      <button
        type="button"
        data-kind={cellKind(r, c)}
        aria-label={cellLabel(r, c)}
        aria-pressed={sel}
        on:pointerdown={(e) => startDrag(r, c, e)}
        on:pointerenter={() => continueDrag(r, c)}
      >
        {cellLabel(r, c)}
      </button>
    {/each}
  {/each}
</fieldset>
