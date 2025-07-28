<script>
  import { _, locale } from "$lib/i18n";
  import { gtag } from "$lib/ga";

  let resumeUrl = $state("/resume.pdf");
  locale.subscribe((value) => {
    switch (value) {
      case "ja":
        resumeUrl = "/resume-ja.pdf";
        break;
      default:
        resumeUrl = "/resume.pdf";
        break;
    }
  });
  function trackResumeDownload() {
    gtag("event", "resume_download", {
      language: $locale,
      url: resumeUrl,
    });
  }
</script>

<section>
  <div class="explain">
    <h1 rainbow="1">{$_("home.landing.hello")}</h1>
    <h2>
      {$_("home.landing.about")}
    </h2>
    <p>
      <a rel="external" href="mailto:hucancode@gmail.com">
        {$_("common.contact.sendMail")}
      </a>
      /
      <a
        target="_blank"
        rel="noreferrer"
        href={resumeUrl}
        onclick={trackResumeDownload}
      >
        {$_("common.contact.downloadResume")}
      </a>
      /
      <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
        {$_("common.contact.github")}
      </a>
      /
      <a href="/blog">
        {$_("common.contact.blog")}
      </a>
    </p>
  </div>
</section>

<style>
  section {
    min-height: unset;
  }
  h2 {
    font-weight: 600;
    text-align: center;
    min-height: 2.8em;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
    text-align: center;
    font-size: 3.5rem;
  }
  p {
    text-align: center;
    max-width: 640px;
  }
</style>
