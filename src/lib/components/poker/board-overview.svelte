<script>
  import { createEventDispatcher } from "svelte";
  import { handTextToArray, handArrayToText } from "$lib/playgrounds/poker/cards.js";
  import Card from "$lib/components/poker/card.svelte";
  import VillainDisplay from "$lib/components/poker/villain-display.svelte";
  import CardPickerModal from "$lib/components/poker/card-picker-modal.svelte";
  import RangePickerModal from "$lib/components/poker/range-picker-modal.svelte";

  export let disabled = false;

  const VILLAIN_NAMES = ["Alice", "Bob", "Carol", "Dave", "Eve", "Frank", "Grace", "Heidi"];
  const VILLAIN_SLOTS = VILLAIN_NAMES.length;
  let hero = [];
  let community = [];
  let villains = Array(VILLAIN_SLOTS)
    .fill()
    .map(() => ({ notation: "" }));

  let editing = null;

  const dispatch = createEventDispatcher();

  $: heroUsed = community;
  $: communityUsed = hero;

  function open(target) {
    editing = target;
  }

  function closeModal() {
    editing = null;
  }

  function onHeroChange(e) {
    hero = e.detail.cards;
    notify();
  }

  function onCommunityChange(e) {
    community = e.detail.cards;
    notify();
  }

  function onVillainChange(idx, e) {
    villains[idx].notation = e.detail.notation;
    villains = villains;
    notify();
  }

  function clearVillain(idx) {
    villains[idx].notation = "";
    villains = villains;
    editing = null;
    notify();
  }

  function notify() {
    dispatch("updated");
  }

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
  <button type="button" on:click={() => open("board")}>
    <b>Community</b>
    <span>
      {#each Array(5) as _, i}
        <Card card={i < community.length ? community[i] : -1} />
      {/each}
    </span>
  </button>

  <button type="button" on:click={() => open("hero")}>
    <b>You</b>
    <span>
      {#each Array(2) as _, i}
        <Card card={i < hero.length ? hero[i] : -1} />
      {/each}
    </span>
  </button>

  <ul aria-label="Villains">
    {#each villains as v, i (i)}
      <li>
        <button
          type="button"
          class:empty={!v.notation.trim()}
          on:click={() => open({ type: "villain", idx: i })}
        >
          <b>{VILLAIN_NAMES[i]}</b>
          <VillainDisplay notation={v.notation} dead={hero.concat(community)} />
        </button>
      </li>
    {/each}
  </ul>
</fieldset>

{#if editing === "hero"}
  <CardPickerModal
    open={true}
    cards={hero}
    usedCards={heroUsed}
    max={2}
    min={2}
    title="Your two cards"
    on:change={onHeroChange}
    on:close={closeModal}
  />
{:else if editing === "board"}
  <CardPickerModal
    open={true}
    cards={community}
    usedCards={communityUsed}
    max={5}
    min={3}
    title="Community cards"
    on:change={onCommunityChange}
    on:close={closeModal}
  />
{:else if editing && editing.type === "villain"}
  <RangePickerModal
    open={true}
    notation={villains[editing.idx].notation}
    title={`${VILLAIN_NAMES[editing.idx]} range`}
    removable={!!villains[editing.idx].notation.trim()}
    on:change={(e) => onVillainChange(editing.idx, e)}
    on:remove={() => clearVillain(editing.idx)}
    on:close={closeModal}
  />
{/if}

<style>
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }
  fieldset:disabled {
    opacity: 0.6;
  }
  button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0;
    background: none;
    border: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: border-color 100ms, opacity 100ms;
  }
  b {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-neutral-400);
  }
  button > span {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  ul {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    list-style: none;
    margin: 0;
    padding: 0 0 0.5rem;
  }
  li {
    flex: 0 0 min(11rem, 45%);
    scroll-snap-align: start;
    display: flex;
  }
  li button {
    width: 100%;
    padding: 0.5rem;
    background: var(--color-neutral-100);
    color: var(--ink);
  }
  li button.empty {
    opacity: 0.75;
  }
  li button:hover,
  li button:focus-visible {
    opacity: 1;
    border-color: var(--ink);
    outline: none;
  }
</style>
