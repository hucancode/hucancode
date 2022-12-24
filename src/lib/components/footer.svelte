<script>
  import { _, locale } from "svelte-i18n";
  import SendMail from "~icons/simple-icons/minutemailer";
  import Fire from "~icons/ri/fire-fill";
  import Download from "~icons/ri/file-download-fill";
  import Github from "~icons/simple-icons/github";

  let resumeUrl = "/resume.pdf";

  switch ($locale) {
    case "en":
      resumeUrl = "/resume.pdf";
      break;
    case "jp":
      resumeUrl = "/resume-jp.pdf";
      break;
  }
</script>

<section
  class="flex w-full
        max-w-screen-lg flex-col items-center justify-around gap-3 px-4 py-10
        text-gray-800 dark:text-gray-400 md:flex-row md:items-start md:px-10"
>
  <div
    class="mb-10 flex flex-col items-center justify-start gap-3 md:items-start"
  >
    <h1
      class="w-full
    text-center
    text-2xl font-bold text-gray-800 dark:text-white
    md:text-left"
    >
      {$_("common.contact.contact")}
    </h1>
    <div class="flex justify-center gap-2 md:justify-start">
      <SendMail size="1.5em" style={{ marginRight: "0.5em" }} />
      <a
        class="hover:text-blue-900 hover:dark:text-blue-300"
        rel="external"
        href="mailto:hucancode@gmail.com"
      >
        hucancode@gmail.com
      </a>
    </div>
    <div class="flex justify-center gap-2 md:justify-start">
      <Download />
      <a
        class="hover:text-blue-900 hover:dark:text-blue-300"
        target="_blank"
        rel="noreferrer"
        href={resumeUrl}
      >
        {$_("common.contact.downloadResume")}
      </a>
    </div>
  </div>
  <div
    class="mb-10 flex flex-col items-center justify-start gap-3 md:items-start"
  >
    <h1
      class="w-full
    text-center
    text-2xl font-bold text-gray-800 dark:text-white
    md:text-left"
    >
      {$_("common.contact.social")}
    </h1>
    <div class="flex justify-center gap-2 md:justify-start">
      <Github size="1.5em" style={{ marginRight: "0.5em" }} />
      <a
        class="hover:text-blue-900 hover:dark:text-blue-300"
        target="_blank"
        rel="noreferrer"
        href="https://github.com/hucancode"
      >
        {$_("common.contact.github")}
      </a>
    </div>
    <div class="flex justify-center gap-2 md:justify-start">
      <Fire size="1.5em" style={{ marginRight: "0.5em" }} />
      <a
        data-sveltekit:prefetch
        class="hover:text-blue-900 hover:dark:text-blue-300"
        href="/blog"
      >
        {$_("common.contact.blog")}
      </a>
    </div>
  </div>
</section>
<p class="mb-10 text-xs text-gray-500">{$_("common.note.madeWith")}</p>
