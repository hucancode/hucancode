import { browser } from "$app/environment";
export const prerender = true;
export async function load() {
  if (!browser) {
    return;
  }
  let { registerIconLibrary } = await import(
    "@shoelace-style/shoelace/dist/utilities/icon-library"
  );
  registerIconLibrary("fx", {
    resolver: (name) => `assets/icons/firefox/${name}.svg`,
  });
  registerIconLibrary("si", {
    resolver: (name) => `assets/icons/simple-icons/${name}.svg`,
  });
}
