import { browser } from "$app/environment";
export const GA_MEASUREMENT_ID = 'G-FV5C3T8B5Y';
export function gtag(){
  if (!browser) return;
  window.dataLayer.push(arguments);
}
export function initGA() {
  if (!browser) return;
  window.dataLayer = window.dataLayer || [];
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID);
  // console.log('GA initialized, dataLayer:', window.dataLayer);
}