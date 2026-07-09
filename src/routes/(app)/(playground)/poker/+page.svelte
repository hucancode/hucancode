<script>
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { init, solveMulti } from "$lib/playgrounds/poker/solver.js";
  import GameBoard from "$lib/components/poker/board-overview.svelte";
  import ResultMulti from "$lib/components/poker/result-multi.svelte";
  import WavingHand from "$lib/components/poker/waving-hand.svelte";
  import Bar from "$lib/components/poker/progress-bar.svelte";

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

<article class="poker">
  <h1>Poker Simulator <WavingHand>🃏</WavingHand></h1>

  <form on:submit|preventDefault={compute}>
    <GameBoard
      disabled={isWorking}
      bind:this={gameBoard}
      on:updated={() => {
        result = { ...UNKNOWN_RESULT };
        errorMessage = "";
      }}
    />
    <div class="action">
      <button type="submit" disabled={isWorking}>Compute</button>
    </div>
  </form>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  <div class="result-area">
    {#if isWorking}
      <Bar />
      <small class="muted">Crunching outcomes…</small>
    {:else if result.ready}
      <ResultMulti {result} />
    {:else}
      <small class="muted"
        >Enter your game state and let computer do the hard work for you</small
      >
    {/if}
  </div>
</article>

<style>
  .poker {
    --bg: var(--paper);
    --fg: var(--ink);
    --muted: var(--color-neutral-400);
    --border: var(--color-neutral-300);
    --card-bg: var(--color-neutral-100);
    width: 100%;
    max-width: 32rem;
    margin: 0 auto;
    padding: 0 1rem;
  }
  h1 {
    margin-top: 0;
    margin-bottom: 1rem;
    text-align: center;
  }
  form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  .action {
    display: flex;
    justify-content: center;
    margin-top: 0.75rem;
  }
  button[type="submit"] {
    background: var(--ink);
    color: var(--paper);
    padding: 0.5rem 1.5rem;
    font-size: 1.125rem;
    font-weight: 700;
    text-transform: uppercase;
    border: 0;
    cursor: pointer;
  }
  .result-area {
    margin-top: 1rem;
    text-align: center;
  }
  .error {
    color: #b91c1c;
    text-align: center;
    font-size: 0.875rem;
    margin: 0.5rem 0;
  }
  .muted {
    color: var(--muted);
  }
</style>
