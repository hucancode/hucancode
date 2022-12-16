<script>
  import { _, locale } from "svelte-i18n";
  import SendMail from "~icons/simple-icons/minutemailer";
  import Fire from "~icons/ri/fire-fill";
  import Download from "~icons/ri/file-download-fill";
  import Github from "~icons/simple-icons/github";
  let resumeUrl = $locale == "en" ? "/resume.pdf" : "/resume-jp.pdf";
</script>

<section
  class="flex w-full
        max-w-screen-lg flex-col items-center justify-around gap-3 px-4 py-10
        md:flex-row md:items-start md:px-10"
>

  <div
    class="mb-10 flex flex-col items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start"
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
    class="mb-10 flex flex-col items-center justify-start gap-3 text-sm text-gray-800 dark:text-gray-400 md:items-start"
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
        class="hover:text-blue-900 hover:dark:text-blue-300"
        target="_blank"
        rel="noreferrer"
        href="https://blog.hucanco.de"
      >
        {$_("common.contact.blog")}
      </a>
    </div>
  </div>
</section>
