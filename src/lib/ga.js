import { browser } from "$app/environment";
import { PUBLIC_GA_MEASUREMENT_ID as GA_MEASUREMENT_ID } from "$env/static/public";

function gtag() {
  if (!browser || !GA_MEASUREMENT_ID) return;
  window.dataLayer.push(arguments);
}
function initGA() {
  if (!browser || !GA_MEASUREMENT_ID) return;
  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
  // console.log('GA initialized, dataLayer:', window.dataLayer);
}

export { GA_MEASUREMENT_ID, gtag, initGA };
