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
  <h1>{$_("cert.title") || "Certifications & Qualifications"}</h1>

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

  <h2 class="section-title">{$_("cert.languages") || "Language Proficiency"}</h2>
  <div class="lang-grid">
    {#each languageCertifications as lang}
      <div class="lang-card">
        <span class="lang-icon">{lang.icon}</span>
        <div class="lang-info">
          <h3 class="lang-label">{lang.label}</h3>
          <div class="lang-score">{lang.score}</div>
          <span class="lang-issuer">{lang.issuer} • {lang.date}</span>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .cert-container {
    min-height: calc(100vh - 8rem);
    padding: 2rem 1rem;
    max-width: 1024px;
    margin: 0 auto;
  }

  h1 {
    text-align: center;
    font-size: 2.5rem;
    margin-bottom: 3rem;
    color: var(--color-neutral-950);
    font-weight: 600;
  }

  .section-title {
    font-size: 1.5rem;
    margin: 2.5rem 0 1.5rem;
    color: var(--color-neutral-800);
    font-weight: 500;
  }

  .cert-grid {
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    margin-bottom: 3rem;
  }

  .cert-card {
    background: var(--color-neutral-100);
    overflow: hidden;
    transition: all 0.3s ease;
    border: 1px solid transparent;
  }

  .cert-card:hover {
    border-color: var(--color-primary-300);
  }

  .cert-image-link {
    display: block;
    width: 100%;
    height: 200px;
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
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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

  .lang-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }

  .lang-card {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1.75rem;
    background: var(--color-neutral-100);
    transition: all 0.3s ease;
    border: 1px solid transparent;
  }

  .lang-card:hover {
    background: var(--color-primary-100);
    border-color: var(--color-primary-300);
  }

  .lang-icon {
    font-size: 3rem;
    min-width: 4rem;
    text-align: center;
  }

  .lang-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .lang-label {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.3;
    margin: 0;
    color: var(--color-neutral-950);
  }

  .lang-score {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary-600);
    margin: 0.25rem 0;
  }

  .lang-issuer {
    font-size: 0.85rem;
    color: var(--color-neutral-600);
  }

  @media (prefers-color-scheme: dark) {
    .cert-card,
    .lang-card {
      background: var(--color-neutral-100);
    }

    .cert-image-link {
      background: var(--color-neutral-200);
    }

    .cert-card:hover,
    .lang-card:hover {
      background: var(--color-primary-100);
      border-color: var(--color-primary-400);
    }

    .section-title {
      color: var(--color-neutral-900);
    }

    .cert-issuer,
    .lang-issuer {
      color: var(--color-neutral-500);
    }

    .cert-date {
      color: var(--color-neutral-400);
    }
  }
</style>
