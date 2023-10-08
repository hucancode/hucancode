import { browser } from "$app/environment";
export const prerender = true;
export async function load() {
  if (!browser) {
    return;
  }
  let { registerIconLibrary } = await import(
    "@shoelace-style/shoelace/dist/utilities/icon-library"
  );
  registerIconLibrary("default", {
    resolver: (name) => `assets/icons/default/${name}.svg`,
  });
}
