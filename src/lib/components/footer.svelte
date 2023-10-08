<script>
  import { _, locale } from "$lib/i18n";
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

<section>
  <div>
    <h1>
      {$_("common.contact.contact")}
    </h1>
    <p>
      <SendMail size="1.5em" style={{ marginRight: "0.5em" }} />
      <a rel="external" href="mailto:hucancode@gmail.com">
        hucancode@gmail.com
      </a>
    </p>
    <p>
      <Download />
      <a target="_blank" rel="noreferrer" href={resumeUrl}>
        {$_("common.contact.downloadResume")}
      </a>
    </p>
  </div>
  <div>
    <h1>
      {$_("common.contact.social")}
    </h1>
    <p>
      <Github size="1.5em" style={{ marginRight: "0.5em" }} />
      <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
        {$_("common.contact.github")}
      </a>
    </p>
    <p>
      <Fire size="1.5em" style={{ marginRight: "0.5em" }} />
      <a data-sveltekit:prefetch href="/blog">
        {$_("common.contact.blog")}
      </a>
    </p>
  </div>
</section>
<small>{$_("common.note.madeWith")}</small>

<style>
  section {
    @apply flex w-full
        max-w-screen-lg flex-col items-center justify-around gap-3 px-4 py-10
        text-gray-800 dark:text-gray-400 md:flex-row md:items-start md:px-10;
  }
  h1 {
    @apply w-full
      text-center
      text-2xl font-bold text-gray-800 dark:text-white
      md:text-left;
  }
  div {
    @apply mb-10 flex flex-col items-center justify-start gap-3 md:items-start;
  }
  p {
    @apply flex justify-center gap-2 md:justify-start;
  }
  a {
    @apply hover:text-blue-900 hover:dark:text-blue-300;
  }
  small {
    @apply mb-10 text-xs text-gray-500;
  }
</style>
