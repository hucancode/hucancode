<script>
  export let value;
  export let title;
</script>

<div>
  <span> {title} </span>
  <span> {value} </span>
</div>

<style>
  div {
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 768px) {
    div {
      flex-direction: row;
    }
  }
  span {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    text-align: center;
  }
  span:first-of-type {
    background-color: var(--sl-color-neutral-100);
    color: var(--sl-color-neutral-800);
  }
  span:last-of-type {
    background-color: var(--sl-color-neutral-900);
    color: var(--sl-color-neutral-200);
  }
</style>
