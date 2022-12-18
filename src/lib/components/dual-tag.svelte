<script>
  export let value;
  export let title;
</script>

<div class="flex flex-col md:flex-row">
  <span
    class="bg-sky-200 px-2 py-1 text-center text-gray-700 dark:bg-gray-700 dark:text-gray-100"
  >
    {title}
  </span>
  <span
    class="bg-white px-2 py-1 text-center text-gray-800 dark:bg-black dark:text-white"
  >
    {value}
  </span>
</div>
