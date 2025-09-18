<script>
  import { _, locale } from "$lib/i18n";
  import { gtag } from "$lib/ga";

  const certifications = [
    {
      image: "/certs/saa.png",
      label: "AWS Certified Solutions Architect - Associate",
      url: "https://www.credly.com/badges/217d2ad0-9fd4-47e9-98aa-051e76f1225c",
      date: "2024",
      issuer: "Amazon Web Services"
    },
    {
      image: "/certs/clp.png",
      label: "C Certified Professional Programmer",
      url: "https://www.credly.com/badges/8d826bcc-dac0-4163-b72f-3e5c41defebc",
      date: "2023",
      issuer: "C++ Institute"
    },
    {
      image: "/certs/cpp.png",
      label: "C++ Certified Professional Programmer",
      url: "https://www.credly.com/badges/d19eff1a-d476-4182-b231-b2009111e3c2",
      date: "2023",
      issuer: "C++ Institute"
    }
  ];

  const languageCertifications = [
    {
      icon: "🇯🇵",
      label: "Japanese Language Proficiency Test (JLPT)",
      score: "N2",
      date: "2022",
      issuer: "Japan Foundation"
    },
    {
      icon: "🇬🇧",
      label: "TOEIC - Test of English for International Communication",
      score: "945/990",
      date: "2021",
      issuer: "ETS"
    }
  ];

  const competitiveProgramming = [
    {
      image: "/certs/lc.svg",
      label: "LeetCode",
      rating: "2033",
      rank: "Knight",
      url: "https://leetcode.com/u/hucancode/"
    }
  ];

  function trackCertClick(cert) {
    gtag("event", "cert_click", {
      cert_name: cert.label,
      language: $locale,
    });
  }
</script>

<svelte:head>
  <title>Certifications - Bang Nguyen</title>
  <meta name="description" content="Professional certifications and qualifications" />
</svelte:head>

<section class="cert-container">
  <h1 rainbow="1">{$_("cert.title") || "Certifications & Qualifications"}</h1>

  <h2 class="section-title">{$_("cert.technical") || "Technical Certifications"}</h2>
  <div class="cert-grid">
    {#each certifications as cert}
      <div class="cert-card">
        <a
          href={cert.url}
          class="cert-image-link"
          target="_blank"
          rel="noreferrer"
          onclick={() => trackCertClick(cert)}
        >
          <img src={cert.image} alt={cert.label} class="cert-image" />
        </a>
        <div class="cert-info">
          <a
            href={cert.url}
            class="cert-label"
            target="_blank"
            rel="noreferrer"
            onclick={() => trackCertClick(cert)}
          >
            {cert.label}
          </a>
          <span class="cert-issuer">{cert.issuer}</span>
          <span class="cert-date">{cert.date}</span>
        </div>
      </div>
    {/each}
  </div>

  <h2 class="section-title">{$_("cert.competition") || "Competitive Programming"}</h2>
  <div class="cert-grid">
    {#each competitiveProgramming as platform}
      <div class="cert-card">
        <a
          href={platform.url}
          class="cert-image-link"
          target="_blank"
          rel="noreferrer"
          onclick={() => trackCertClick(platform)}
        >
          <img src={platform.image} alt={platform.label} class="cert-image" />
        </a>
        <div class="cert-info">
          <a
            href={platform.url}
            class="cert-label"
            target="_blank"
            rel="noreferrer"
            onclick={() => trackCertClick(platform)}
          >
            {platform.label}
          </a>
          <span class="cert-issuer">Rating: {platform.rating} ({platform.rank})</span>
        </div>
      </div>
    {/each}
  </div>

  <h2 class="section-title">{$_("cert.languages") || "Language Proficiency"}</h2>
  <div class="cert-grid">
    {#each languageCertifications as lang}
      <div class="cert-card">
        <div class="cert-image-link lang-icon-container">
          <span class="lang-icon-large">{lang.icon}</span>
        </div>
        <div class="cert-info">
          <span class="cert-label">
            {lang.label}
          </span>
          <span class="cert-issuer">{lang.issuer}</span>
          <span class="cert-date">Score: {lang.score} • {lang.date}</span>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .cert-container {
    min-height: calc(100vh - 8rem);
    padding: 2rem 1rem;
    max-width: 64rem;
    margin: 0 auto;
  }

  h1 {
    text-align: center;
    font-size: 2.5rem;
    font-weight: 600;
    animation: bg-pingpong 2.5s ease infinite alternate;
    background-size: 200% 100%;
    cursor: default;
  }

  .section-title {
    font-size: 1.25rem;
    margin: 2.5rem 0 0.5rem;
    color: var(--color-neutral-600);
    font-weight: 400;
    opacity: 0.8;
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }

  .section-title::before {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--color-neutral-200);
    margin-right: 1rem;
  }

  .section-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--color-neutral-200);
    margin-left: 1rem;
  }

  .cert-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 3rem;
    width: 100%;
  }

  .cert-card {
    background: var(--color-neutral-100);
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    width: 100%;
  }

  .cert-card:hover {
    border-color: var(--color-primary-300);
    background: var(--color-primary-100);
  }

  .cert-image-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 9.375rem;
    min-width: 9.375rem;
    height: 7.5rem;
    overflow: hidden;
    background: white;
  }

  .cert-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 1rem;
  }

  .cert-info {
    padding: 1.5rem 1.5rem 1.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .cert-label {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-neutral-950);
    text-decoration: none;
    line-height: 1.3;
    transition: color 0.2s ease;
  }

  .cert-label:hover {
    color: var(--color-primary-600);
  }

  .cert-issuer {
    font-size: 0.95rem;
    color: var(--color-neutral-700);
  }

  .cert-date {
    font-size: 0.85rem;
    color: var(--color-neutral-600);
  }

  .lang-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }

  .lang-icon-large {
    font-size: 4rem;
  }

  @media (max-width: 768px) {
    .cert-image-link {
      width: 7.5rem;
      min-width: 7.5rem;
      height: 6.25rem;
    }

    .cert-info {
      padding: 1rem 1rem 1rem 0;
    }
  }

  @media (max-width: 640px) {
    h1 {
      font-size: 1.8rem;
      margin-bottom: 2rem;
    }

    .section-title {
      font-size: 1.1rem;
      margin: 2rem 0 1rem;
    }

    .cert-card {
      flex-direction: column;
      align-items: flex-start;
      padding: 1rem;
    }

    .cert-image-link {
      width: 100%;
      height: 9.375rem;
      margin-bottom: 0.5rem;
    }

    .lang-icon-container {
      width: 100%;
      height: 7.5rem;
      margin-bottom: 0.5rem;
    }

    .cert-info {
      padding: 0;
      width: 100%;
    }

    .cert-label {
      font-size: 1rem;
    }

    .cert-issuer,
    .cert-date {
      font-size: 0.8rem;
    }

    .lang-icon-large {
      font-size: 3rem;
    }
  }

  @media (max-width: 480px) {
    .cert-container {
      padding: 1rem 0.5rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .section-title::before,
    .section-title::after {
      margin-left: 0.5rem;
      margin-right: 0.5rem;
    }
  }

  @keyframes bg-pingpong {
    from {
      background-position: 0% 50%;
    }
    to {
      background-position: 100% 50%;
    }
  }

  @media (prefers-color-scheme: dark) {
    .cert-card {
      background: var(--color-neutral-100);
    }

    .cert-image-link {
      background: var(--color-neutral-200);
    }

    .lang-icon-container {
      background: transparent;
    }

    .cert-card:hover {
      background: var(--color-primary-100);
      border-color: var(--color-primary-400);
    }

    .section-title {
      color: var(--color-neutral-500);
      opacity: 0.7;
    }

    .section-title::before,
    .section-title::after {
      background: var(--color-neutral-300);
    }

    .cert-issuer {
      color: var(--color-neutral-500);
    }

    .cert-date {
      color: var(--color-neutral-400);
    }
  }
</style>
