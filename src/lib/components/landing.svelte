<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import MiniShowcase from "$lib/components/mini-showcase.svelte";
  import WavingHand from "~icons/twemoji/waving-hand";
  onMount(async () => {
    await import(
      "@shoelace-style/shoelace/dist/components/animation/animation"
    );
  });
</script>

<section>
  <div class="greeting-wrapper">
    <div class="greetings">
      <h1 class="hello">
        {$_("home.landing.hello")}
      </h1>
      <sl-animation
        name="tada"
        duration={1500}
        delay={1000}
        end-delay={1000}
        play
      >
        <span>👋</span>
      </sl-animation>
    </div>
    <p class="about">{$_("home.landing.about")}</p>
  </div>
  <MiniShowcase />
</section>

<style>
  section {
    flex-direction: column;
  }
  .greeting-wrapper {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  .greetings {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    white-space: nowrap;
    background-image: linear-gradient(
      141.27deg,
      #ff904e 0%,
      #ff5982 20%,
      #ec68f4 40%,
      #79e2ff 80%
    );
    font-size: var(--sl-font-size-2x-large);
    font-weight: var(--sl-font-weight-bold);
    background-size: 200% 100%;
    color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
    padding-bottom: 0.25rem;
  }
  span {
    font-size: 3rem;
    width: 1em;
    aspect-ratio: 1;
    cursor: default;
  }
  .about {
    text-align: center;
  }
  @media (min-width: 768px) {
    section {
      flex-direction: row;
      justify-content: space-between;
    }
    .greeting-wrapper {
      width: 40%;
      align-items: flex-start;
      padding-top: 0px;
      padding-bottom: 0px;
    }
    .about {
      text-align: left;
    }
  }
  @keyframes bg-pingpong {
    to {
      background-position-x: 50%;
    }
  }
</style>
