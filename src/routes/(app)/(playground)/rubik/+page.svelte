<script>
  import Scene from "$lib/components/playground-canvas.svelte";
  import * as rubik from "$lib/playgrounds/rubik";

  let size = $state(3);
  let speed = $state(1);
  let autoplay = $state(true);
  let randomEase = $state(true);

  let scrambleText = $state("");
  let badScramble = $state(false);

  // solution playback state, pushed by the playground
  let solvePos = $state(0);
  let solveTotal = $state(0);
  let solvePlaying = $state(false);

  // cube size must be set before the canvas host mounts (re-keyed below)
  function sized(s) {
    rubik.setCubeSize(s);
    return rubik;
  }

  $effect(() => {
    rubik.setConfig({
      speed, autoplay, randomEase,
      onSolution: (s) => {
        solvePos = s.pos;
        solveTotal = s.total;
        solvePlaying = s.playing;
      },
    });
  });

  function randomScramble() {
    scrambleText = rubik.scramble();
    badScramble = false;
  }
  function applyScramble() {
    badScramble = !rubik.applyScramble(scrambleText);
  }
</script>

<svelte:head>
  <title>Rubik</title>
</svelte:head>

<section>
  {#key size}
    <Scene scene={sized(size)} id="rubik" />
  {/key}
</section>

<aside>
  <fieldset>
    <legend>parameters</legend>
    <label>
      <span>Cube size</span>
      <input type="range" min="2" max="6" step="1" bind:value={size} />
      <output>{size}</output>
    </label>
    <label>
      <span>Turn speed</span>
      <input type="range" min="0.25" max="3" step="0.25" bind:value={speed} />
      <output>{speed.toFixed(2)}</output>
    </label>
    <label>
      <input type="checkbox" bind:checked={autoplay} />
      <span>Auto-shuffle</span>
    </label>
    <label>
      <input type="checkbox" bind:checked={randomEase} />
      <span>Random easing</span>
    </label>
  </fieldset>

  <fieldset>
    <legend>scramble</legend>
    <textarea rows="3" bind:value={scrambleText} placeholder="R U' Fw2 ..."></textarea>
    {#if badScramble}
      <small>invalid notation</small>
    {/if}
    <menu>
      <li><button onclick={randomScramble}>random</button></li>
      <li><button onclick={applyScramble} disabled={!scrambleText.trim()}>apply</button></li>
    </menu>
  </fieldset>

  <menu>
    {#if !autoplay}
      <li><button onclick={() => rubik.step()}>One move</button></li>
    {/if}
    {#if size === 3}
      <li>
        <button
          onclick={() => {
            autoplay = false;
            rubik.solveCube();
          }}>Solve</button
        >
      </li>
    {/if}
  </menu>

  {#if solveTotal}
    <fieldset>
      <legend>solution</legend>
      <label>
        <span>move {solvePos}/{solveTotal}</span>
        <input
          type="range"
          min="0"
          max={solveTotal}
          step="1"
          value={solvePos}
          oninput={(e) => rubik.seekSolution(+e.currentTarget.value)}
        />
      </label>
      <menu>
        <li>
          <button
            onclick={() => (solvePlaying ? rubik.pauseSolution() : rubik.playSolution())}
            disabled={!solvePlaying && solvePos >= solveTotal}
          >
            {solvePlaying ? "pause" : "play"}
          </button>
        </li>
      </menu>
    </fieldset>
  {/if}
</aside>
