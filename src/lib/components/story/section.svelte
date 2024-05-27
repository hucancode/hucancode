<script>

</script>

<section class="container">
  <div class="primary">
    <slot name="primary"></slot>
  </div>
  <div class="secondary">
    <slot name="secondary"></slot>
  </div>
</section>

<style>
  section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    height: 90vh;
  }
  div {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    border-radius: 0.5rem;
  }

  .primary {
    grid-column: 1 / 2;
    background-color: rgb(22, 27, 34);
  }

  .secondary {
    grid-column: 2 / 3;
    background-color: #2a3e4b;
  }
  @media (max-width: 768px) {
    section {
      grid-template-columns: none;
      grid-template-rows: 1fr 1fr;
    }
  }
</style>