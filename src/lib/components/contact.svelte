<script>
  import { _, locale } from "$lib/i18n";
  import Email from "$icons/google-material/mail.svg?raw";
  import Download from "$icons/google-material/download.svg?raw";
  import Github from "$icons/simple-icons/github.svg?raw";
  import Banana from "$icons/fluent/banana-hc.svg?raw";

  let resumeUrl = "/resume.pdf";

  switch ($locale) {
    case "en":
      resumeUrl = "/resume.pdf";
      break;
    case "jp":
      resumeUrl = "/resume-jp.pdf";
      break;
    default:
      resumeUrl = "/resume.pdf";
      break;
  }
</script>

<section>
  <div>
    <h2>
      {$_("common.contact.contact")}
    </h2>
    <small>
      {@html Email}
      <a rel="external" href="mailto:hucancode@gmail.com">
        hucancode@gmail.com
      </a>
    </small>
    <small>
      {@html Download}
      <a target="_blank" rel="noreferrer" href={resumeUrl}>
        {$_("common.contact.downloadResume")}
      </a>
    </small>
  </div>
  <div>
    <h2>
      {$_("common.contact.social")}
    </h2>
    <small>
      {@html Github}
      <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
        {$_("common.contact.github")}
      </a>
    </small>
    <small>
      {@html Banana}
      <a href="/blog">
        {$_("common.contact.blog")}
      </a>
    </small>
  </div>
</section>

<style>
  section {
    justify-content: space-around;
    gap: 0.75rem;
    padding: 2.5rem;
    align-items: start;
    flex-direction: row;
    flex-wrap: wrap;
  }
  h2 {
    width: 100%;
    text-align: left;
    font-size: large;
    font-weight: bold;
  }
  div {
    width: 100%;
    margin-bottom: 2.5rem;
    display: flex;
    flex-direction: column;
    align-items: start;
    justify-content: flex-start;
    gap: 0.75rem;
  }
  @media (min-width: 480px) {
    div {
      width: unset;
    }
  }
  small {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
