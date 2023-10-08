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
    justify-content: space-around;
    gap: 0.75rem;
    padding-top: 2.5rem;
    padding-bottom: 2.5rem;
  }
  @media (min-width: 768px) {
    section {
      flex-direction: row;
      align-items: flex-start;
      padding-left: 2.5rem;
      padding-right: 2.5rem;
    }
  }
  h1 {
    width: 100%;
    text-align: center;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
  }
  @media (min-width: 768px) {
    h1 {
      text-align: left;
    }
  }
  @media (min-width: 768px) {
    div {
      align-items: flex-start;
    }
  }
  div {
    margin-bottom: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
  }
  @media (min-width: 768px) {
    p {
      justify-content: flex-start;
    }
  }
  p {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
  small {
    margin-bottom: 2.5rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: rgb(107 114 128);
  }
</style>
