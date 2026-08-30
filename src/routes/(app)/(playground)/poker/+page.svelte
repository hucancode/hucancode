<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { init, solveMulti } from "$lib/playgrounds/poker/solver.js";
  import GameBoard from "$lib/components/poker/board-overview.svelte";
  import "$styles/poker.css";

  const UNKNOWN_RESULT = {
    iterations: 0,
    heroWin: 0,
    heroTie: 0,
    heroLose: 0,
    villainEquity: [],
    villainNames: [],
    time: 0,
    ready: false,
  };

  let gameBoard;
  let result = { ...UNKNOWN_RESULT };
  let isWorking = false;
  let errorMessage = "";

  $: heroEquity = result.heroWin + result.heroTie / 2;

  // let the "crunching" state paint before the solver blocks the main thread
  function nextPaint() {
    return new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }

  async function compute() {
    if (isWorking) return;
    errorMessage = "";
    result = { ...UNKNOWN_RESULT };
    if (!gameBoard.isValid()) {
      errorMessage =
        "Pick 2 hero cards, 3-5 board cards, and a range for at least one villain.";
      return;
    }
    syncUrl();
    isWorking = true;
    await nextPaint();
    const t0 = Date.now();
    try {
      await init();
      const r = solveMulti(
        gameBoard.getHero(),
        gameBoard.getVillainNotations(),
        gameBoard.getCommunity(),
        0,
        0,
      );
      result = {
        ...r,
        villainNames: gameBoard.getActiveVillainNames(),
        time: Date.now() - t0,
        ready: true,
      };
    } catch (e) {
      errorMessage = e.message ?? String(e);
    } finally {
      isWorking = false;
    }
  }

  function syncUrl() {
    const params = new URLSearchParams();
    params.set("h", gameBoard.getHero());
    params.set("c", gameBoard.getCommunity());
    for (const v of gameBoard.getVillainNotations()) params.append("v", v);
    goto(`?${params.toString()}`, { keepFocus: true, noScroll: true });
  }

  const pct = (x) => `${(x * 100).toFixed(2)}%`;
  const round = (x) => `${(x * 100).toFixed(0)}%`;

  onMount(() => {
    const params = $page.url.searchParams;
    if (params.has("h") || params.has("v") || params.has("c")) {
      gameBoard.loadFromUrl(params);
      compute();
    } else {
      gameBoard.randomize();
    }
  });
</script>

<svelte:head>
  <title>Poker</title>
</svelte:head>

<h1>Poker Simulator <span>🃏</span></h1>

<form on:submit|preventDefault={compute}>
  <GameBoard
    disabled={isWorking}
    bind:this={gameBoard}
    on:updated={() => {
      result = { ...UNKNOWN_RESULT };
      errorMessage = "";
    }}
  />
  <button type="submit" disabled={isWorking}>Compute</button>
</form>

{#if errorMessage}
  <strong>{errorMessage}</strong>
{/if}

<output>
  {#if isWorking}
    <progress></progress>
    <small>Crunching outcomes…</small>
  {:else if result.ready}
    <section>
      <hgroup>
        <h3>Your equity</h3>
        <p><data value={heroEquity}>{pct(heroEquity)}</data></p>
      </hgroup>

      <ul aria-label="Hero outcomes">
        <li
          data-outcome="win"
          style="flex: {result.heroWin}"
          title="Win {round(result.heroWin)}"
        >
          {#if result.heroWin > 0.2}Win {round(result.heroWin)}{/if}
        </li>
        <li
          data-outcome="tie"
          style="flex: {result.heroTie}"
          title="Tie {round(result.heroTie)}"
        >
          {#if result.heroTie > 0.2}Tie {round(result.heroTie)}{/if}
        </li>
        <li
          data-outcome="lose"
          style="flex: {result.heroLose}"
          title="Lose {round(result.heroLose)}"
        >
          {#if result.heroLose > 0.2}Lose {round(result.heroLose)}{/if}
        </li>
      </ul>

      {#if result.villainEquity.length > 0}
        <h3>Villain equity</h3>
        <ul>
          {#each result.villainEquity as eq, i}
            <li>
              <b>{result.villainNames[i] ?? ""}</b>
              <meter value={eq} max="1" aria-label={result.villainNames[i] ?? ""}
              ></meter>
              <data value={eq}>{pct(eq)}</data>
            </li>
          {/each}
        </ul>
      {/if}

      <small>
        {#if result.time > 2000}
          In the matter of
          <em>{Math.floor(result.time / 1000)} seconds</em>,
        {/if}
        I have fast-forwarded into the future and saw
        <em>{result.iterations.toLocaleString()}</em>
        outcomes,
        <em>{Math.round(result.heroWin * result.iterations).toLocaleString()}</em>
        of that you win
      </small>
    </section>
  {:else}
    <small>Enter your game state and let computer do the hard work for you</small>
  {/if}
</output>
