<script>
  export let value;
  export let title;
</script>

<small>
  <span> {title} </span>
  <span> {value} </span>
</small>

<style>
  small {
    display: flex;
    flex-direction: row;
  }
  span {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
    text-align: center;
  }
  span:first-of-type {
    background-color: var(--color-neutral-100);
    color: var(--color-neutral-900);
  }
  span:last-of-type {
    background-color: var(--color-neutral-200);
    color: var(--color-neutral-950);
  }
</style>
