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
    background-color: rgb(186 230 253);
    color: rgb(55 65 81);
  }
  .dark span:first-of-type {
    background-color: rgb(55 65 81);
    color: rgb(243 244 246);
  }
  span:last-of-type {
    background-color: rgb(255 255 255);
    color: rgb(31 41 55);
  }
  .dark span:last-of-type {
    background-color: rgb(0 0 0);
    color: rgb(31 41 55);
  }
</style>
