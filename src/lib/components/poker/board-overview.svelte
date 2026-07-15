<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import {
    handTextToArray,
    handArrayToText,
  } from "$lib/playgrounds/poker/cards.js";
  import { expandNotationToCombos } from "$lib/playgrounds/poker/range.js";
  import Card from "$lib/components/poker/card.svelte";
  import RangeMatrix from "$lib/components/poker/range-matrix.svelte";

  export let disabled = false;

  const VILLAIN_NAMES = [
    "Alice",
    "Bob",
    "Carol",
    "Dave",
    "Eve",
    "Frank",
    "Grace",
    "Heidi",
  ];
  const VILLAIN_SLOTS = VILLAIN_NAMES.length;
  /** how often each villain slot re-draws a sample hand from its range */
  const SAMPLE_INTERVAL_MS = 3000;

  const dispatch = createEventDispatcher();

  let hero = [];
  let community = [];
  let villains = Array(VILLAIN_SLOTS)
    .fill()
    .map(() => ({ notation: "" }));

  /** "hero" | "board" | villain slot index | null */
  let editing = null;
  let dialog;

  // ---- the one dialog, in card-picking or range-picking mode ---------------

  $: pickingCards = editing === "hero" || editing === "board";
  $: pickingRange = typeof editing === "number";
  $: picked = editing === "hero" ? hero : community;
  $: usedElsewhere = editing === "hero" ? community : hero;
  $: pickMax = editing === "hero" ? 2 : 5;
  $: pickMin = editing === "hero" ? 2 : 3;
  $: title =
    editing === "hero"
      ? "Your two cards"
      : editing === "board"
        ? "Community cards"
        : pickingRange
          ? `${VILLAIN_NAMES[editing]} range`
          : "";

  $: if (dialog) {
    if (editing !== null && !dialog.open) dialog.showModal();
    else if (editing === null && dialog.open) dialog.close();
  }

  function close() {
    editing = null;
  }

  // backdrop click: the dialog element *is* the panel, so a click only counts as
  // "outside" when it targets the dialog itself and lands beyond its box.
  function onDialogClick(e) {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;
    if (!inside) close();
  }

  function toggleCard(i) {
    let next;
    if (picked.includes(i)) {
      next = picked.filter((x) => x !== i);
    } else {
      if (picked.length >= pickMax) return;
      next = [...picked, i];
    }
    if (editing === "hero") hero = next;
    else community = next;
    notify();
  }

  function setVillain(idx, notation) {
    villains[idx].notation = notation;
    villains = villains;
    notify();
  }

  function clearVillain(idx) {
    setVillain(idx, "");
    close();
  }

  function notify() {
    dispatch("updated");
  }

  // ---- sample hands: one timer drives every villain slot -------------------

  let tick = 0;
  const lastPick = Array(VILLAIN_SLOTS).fill(0);

  $: dead = hero.concat(community);
  $: combos = villains.map((v) => expandNotationToCombos(v.notation, dead));
  // `tick` is a dependency on purpose: it is what re-rolls the sample hands.
  $: sample = drawSamples(combos, tick);

  /** one random combo per villain, avoiding an immediate repeat.
   * `_tick` is unused: it is only there to make the call re-run on each tick. */
  function drawSamples(all, _tick) {
    return all.map((cs, i) => {
      if (cs.length === 0) return null;
      let k = Math.floor(Math.random() * cs.length);
      if (cs.length > 1 && k === lastPick[i]) k = (k + 1) % cs.length;
      lastPick[i] = k;
      return cs[k];
    });
  }

  onMount(() => {
    const timer = setInterval(() => (tick += 1), SAMPLE_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  // ---- API used by the page ------------------------------------------------

  export function getHero() {
    return handArrayToText(hero);
  }
  export function getCommunity() {
    return handArrayToText(community);
  }
  export function getVillainNotations() {
    return villains.map((v) => v.notation).filter((n) => n.trim());
  }
  export function getActiveVillainNames() {
    return VILLAIN_NAMES.filter((_, i) => villains[i].notation.trim());
  }
  export function getVillainSlots() {
    return villains.map((v) => v.notation);
  }
  export function isValid() {
    if (hero.length !== 2) return false;
    if (community.length < 3 || community.length > 5) return false;
    if (!villains.some((v) => v.notation.trim())) return false;
    return true;
  }
  export function loadFromUrl(params) {
    const h = params.get("h");
    if (h) hero = handTextToArray(h);
    const c = params.get("c");
    if (c) community = handTextToArray(c);
    const vs = params.getAll("v");
    if (vs.length > 0) {
      villains = Array(VILLAIN_SLOTS)
        .fill()
        .map((_, i) => ({ notation: vs[i] ?? "" }));
    }
    notify();
  }
  export function randomize() {
    const pool = Array(52)
      .fill()
      .map((_, i) => i)
      .sort(() => Math.random() - 0.5);
    hero = pool.slice(0, 2);
    const boardSize = 3 + Math.floor(Math.random() * 3);
    community = pool.slice(2, 2 + boardSize);
    villains = Array(VILLAIN_SLOTS)
      .fill()
      .map(() => ({ notation: "" }));
    villains[0].notation = "QQ+,AKs,AKo";
    notify();
  }
</script>

<fieldset {disabled}>
  <button type="button" on:click={() => (editing = "board")}>
    <b>Community</b>
    {#each Array(5) as _, i}
      <Card card={i < community.length ? community[i] : -1} />
    {/each}
  </button>

  <button type="button" on:click={() => (editing = "hero")}>
    <b>You</b>
    {#each Array(2) as _, i}
      <Card card={i < hero.length ? hero[i] : -1} />
    {/each}
  </button>

  <ul aria-label="Villains">
    {#each villains as v, i (i)}
      <li>
        <button type="button" on:click={() => (editing = i)}>
          <b>{VILLAIN_NAMES[i]}</b>
          {#key sample[i]}
            <span in:fade={{ duration: 300 }} out:fade={{ duration: 300 }}>
              <Card card={sample[i] ? sample[i][0] : -1} />
              <Card card={sample[i] ? sample[i][1] : -1} />
            </span>
          {/key}
        </button>
      </li>
    {/each}
  </ul>
</fieldset>

<dialog bind:this={dialog} on:close={close} on:click={onDialogClick}>
  {#if pickingCards}
    <h3>
      {title}
      <output data-invalid={picked.length < pickMin || null}>
        {picked.length} / {pickMax}
      </output>
    </h3>

    <output>
      {#each Array(pickMax) as _, i}
        <Card card={i < picked.length ? picked[i] : -1} />
      {/each}
    </output>

    <fieldset>
      {#each Array(52) as _, i}
        <Card
          card={i}
          selectable
          used={usedElsewhere.includes(i)}
          selected={picked.includes(i)}
          on:selectedChange={() => toggleCard(i)}
        />
      {/each}
    </fieldset>

    <footer>
      <button type="button" on:click={close}>Done</button>
    </footer>
  {:else if pickingRange}
    <h3>{title}</h3>

    <RangeMatrix
      notation={villains[editing].notation}
      on:change={(e) => setVillain(editing, e.detail.notation)}
    />

    <details>
      <summary>Notation</summary>
      <input
        type="text"
        value={villains[editing].notation}
        on:change={(e) => setVillain(editing, e.target.value)}
        placeholder="e.g. QQ+,AKs,AKo"
      />
    </details>

    <footer>
      {#if villains[editing].notation.trim()}
        <button type="button" data-danger on:click={() => clearVillain(editing)}>
          Remove
        </button>
      {/if}
      <button type="button" on:click={close}>Done</button>
    </footer>
  {/if}
</dialog>
