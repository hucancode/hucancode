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
    <h1 rainbow="1" class="xl">{$_("home.landing.hello")}</h1>
    <h1>
      {$_("home.landing.about")}
    </h1>
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
      <a
        target="_blank"
        rel="noreferrer"
        href="https://leetcode.com/u/hucancode"
      >
        {$_("common.contact.leetcode")}
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
  h1.xl {
    font-size: 3.5rem;
  }
  h1 {
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
    display: flex;
    gap: 0.5em;
    align-items: center;
    text-align: center;
  }
  p {
    text-align: center;
    max-width: 640px;
  }
</style>
