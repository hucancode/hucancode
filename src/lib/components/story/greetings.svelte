<script>
  import { _ } from "$lib/i18n";
</script>
<section>
  <div class="explain">
    <h1 rainbow="1" class="xl">{$_("home.landing.hello")}</h1>
    <h1>
      {$_("home.landing.about")}
    </h1>
  </div>
</section>
<style>
  section {
    min-height: unset;
  }
  h1.xl {
    font-size: 3.5rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
    text-align: center;
  }
  p {
    text-align: center;
    max-width: 640px;
  }
</style>