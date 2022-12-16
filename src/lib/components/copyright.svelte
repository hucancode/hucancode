<script>
  import { _ } from "svelte-i18n";
</script>

<div
  class="container
        relative
        flex
        w-full max-w-screen-lg items-center
        justify-center overflow-hidden
        pb-5
        text-center
        text-xs
        text-gray-500"
>
  <p>{$_("common.note.madeWith")}</p>
</div>
