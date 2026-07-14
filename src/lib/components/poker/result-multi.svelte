<script>
  export let result = {
    iterations: 0,
    heroWin: 0,
    heroTie: 0,
    heroLose: 0,
    villainEquity: [],
    villainNames: [],
    time: 0,
  };

  $: heroEquity = result.heroWin + result.heroTie / 2;
</script>

<section>
  <hgroup>
    <h3>Your equity</h3>
    <p><data value={heroEquity}>{(heroEquity * 100).toFixed(2)}%</data></p>
  </hgroup>

  <div class="bar" aria-label="Hero outcomes">
    <span
      class="win"
      style="flex: {result.heroWin};"
      title="Win {(result.heroWin * 100).toFixed(0)}%"
    >
      {#if result.heroWin > 0.2}Win {(result.heroWin * 100).toFixed(0)}%{/if}
    </span>
    <span
      class="tie"
      style="flex: {result.heroTie};"
      title="Tie {(result.heroTie * 100).toFixed(0)}%"
    >
      {#if result.heroTie > 0.2}Tie {(result.heroTie * 100).toFixed(0)}%{/if}
    </span>
    <span
      class="lose"
      style="flex: {result.heroLose};"
      title="Lose {(result.heroLose * 100).toFixed(2)}%"
    >
      {#if result.heroLose > 0.2}Lose {(result.heroLose * 100).toFixed(0)}%{/if}
    </span>
  </div>

  {#if result.villainEquity.length > 0}
    <h3>Villain equity</h3>
    <ul>
      {#each result.villainEquity as eq, i}
        <li>
          <b>{result.villainNames[i] ?? ""}</b>
          <meter value={eq} max="1" aria-label={result.villainNames[i] ?? ""}></meter>
          <data value={eq}>{(eq * 100).toFixed(2)}%</data>
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

<style>
  section {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    width: 100%;
    max-width: 28rem;
    margin: 0 auto;
  }
  hgroup {
    text-align: center;
  }
  h3 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: normal;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  hgroup p {
    margin: 0;
    font-size: 2.5rem;
    font-weight: 800;
    font-family: ui-monospace, monospace;
    line-height: 1.1;
  }
  .bar {
    display: flex;
    width: 100%;
    height: 1.75rem;
    overflow: hidden;
  }
  .bar span {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
  }
  .win {
    background: #16a34a;
  }
  .tie {
    background: #2563eb;
  }
  .lose {
    background: #dc2626;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    display: grid;
    grid-template-columns: 3.5rem 1fr 3.5rem;
    align-items: center;
    gap: 0.5rem;
  }
  li b {
    text-align: left;
  }
  meter {
    width: 100%;
    height: 0.625rem;
  }
  li data {
    text-align: right;
    font-family: ui-monospace, monospace;
    font-size: 0.875rem;
  }
  small {
    color: #6b7280;
    text-align: center;
    font-size: 0.875rem;
    line-height: 1.5;
    margin-top: 0.5rem;
  }
  em {
    font-style: italic;
    font-weight: 600;
  }
</style>
