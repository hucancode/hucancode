import { browser } from "$app/env";
import * as env from "$app/env/public";

// a dummy id keeps dev and unconfigured builds working
const GA_MEASUREMENT_ID = env.PUBLIC_GA_MEASUREMENT_ID || "xxxx";

function gtag() {
  if (!browser || !GA_MEASUREMENT_ID) return;
  (window.dataLayer ||= []).push(arguments);
}
function initGA() {
  if (!browser || !GA_MEASUREMENT_ID) return;
  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
}

const fired = new Set();
function trackOnce(key, name, params) {
  if (!browser || fired.has(key)) return;
  fired.add(key);
  gtag("event", name, params);
}

// which GPU backend the client got (webgpu vs webgl2)
function trackBackend(backend) {
  trackOnce("backend", "gpu_backend", { backend });
}

// timeline travel milestones: 20% / 50% / 100%
const MILESTONES = [0.2, 0.5, 1];
function trackMilestone(progress) {
  for (const m of MILESTONES) {
    if (progress >= m) {
      const pct = Math.round(m * 100);
      trackOnce(`ms_${pct}`, "timeline_progress", { percent: pct });
    }
  }
}

export { GA_MEASUREMENT_ID, gtag, initGA, trackBackend, trackMilestone };
