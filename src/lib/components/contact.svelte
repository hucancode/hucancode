<script>
  import { onMount } from "svelte";
  import { _, locale } from "$lib/i18n";

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

  onMount(async () => {
    await import("$shoelace/icon/icon");
  });
</script>

<section>
  <div>
    <h2>
      {$_("common.contact.contact")}
    </h2>
    <small>
      <sl-icon name="email" library="line-md" />
      <a rel="external" href="mailto:hucancode@gmail.com">
        hucancode@gmail.com
      </a>
    </small>
    <small>
      <sl-icon name="document" library="line-md" />
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
      <sl-icon name="github" library="line-md" />
      <a target="_blank" rel="noreferrer" href="https://github.com/hucancode">
        {$_("common.contact.github")}
      </a>
    </small>
    <small>
      <sl-icon name="coffee" library="line-md" />
      <a data-sveltekit:prefetch href="/blog">
        {$_("common.contact.blog")}
      </a>
    </small>
  </div>
</section>

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
      align-items: start;
      padding-left: 2.5rem;
      padding-right: 2.5rem;
    }
  }
  h2 {
    width: 100%;
    text-align: center;
    font-size: large;
    font-weight: var(--sl-font-weight-bold);
  }
  @media (min-width: 768px) {
    h2 {
      text-align: left;
    }
  }
  @media (min-width: 768px) {
    div {
      align-items: start;
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
    div {
      align-items: start;
    }
  }
  small {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  sl-icon {
    font-size: larger;
  }
</style>
