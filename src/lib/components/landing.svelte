<script>
  import { _ } from "$lib/i18n";
  import { onMount } from "svelte";
  import MiniShowcase from "$lib/components/mini-showcase.svelte";
  let waving = false;
  let wavingAnimation = [
    {
      offset: 0,
      transform: "rotate(0)",
    },
    {
      offset: 0.1,
      transformOrigin: "80% 80%",
      transform: "rotate(20deg)",
    },
    {
      offset: 0.2,
      transformOrigin: "80% 80%",
      transform: "rotate(-10deg)",
    },
    {
      offset: 0.3,
      transformOrigin: "80% 80%",
      transform: "rotate(10deg)",
    },
    {
      offset: 0.4,
      transformOrigin: "80% 80%",
      transform: "rotate(-10deg)",
    },
    {
      offset: 0.5,
      transform: "rotate(0)",
    },
  ];
  onMount(async () => {
    await import(
      "@shoelace-style/shoelace/dist/components/animation/animation"
    );
    await import("@shoelace-style/shoelace/dist/components/icon/icon");
  });
</script>

<section>
  <div class="greetings">
    <h1 class="hello">
      {$_("home.landing.hello")}
      <sl-animation
        keyframes={wavingAnimation}
        duration={2000}
        play={waving}
        on:mouseenter={() => (waving = true)}
        on:mouseleave={() => (waving = false)}
      >
        <sl-icon name="wave" library="fx"></sl-icon>
      </sl-animation>
    </h1>
    <p class="about">{$_("home.landing.about")}</p>
  </div>
  <MiniShowcase />
</section>

<style>
  section {
    flex-direction: column;
  }
  .greetings {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
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
  }
  p {
    text-align: center;
  }
  @media (min-width: 768px) {
    section {
      flex-direction: row;
      justify-content: space-between;
    }
    .greetings {
      width: 40%;
      align-items: flex-start;
      padding-top: 0;
      padding-bottom: 0;
    }
    p {
      text-align: left;
    }
  }
  @keyframes bg-pingpong {
    to {
      background-position-x: 50%;
    }
  }
</style>
