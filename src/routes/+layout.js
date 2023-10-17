import { browser } from "$app/environment";
export const prerender = true;
export async function load() {
  if (!browser) {
    return;
  }
  let { registerIconLibrary } = await import(
    "@shoelace-style/shoelace/dist/utilities/icon-library"
  );
  let sets = [
    {
      alias: "fx",
      path: "firefox",
    },
    {
      alias: "open",
      path: "openmoji",
    },
    {
      alias: "si",
      path: "simple-icons",
    },
    {
      alias: "line-md",
      path: "line-md",
    },
    {
      alias: "material",
      path: "google-material",
    },
    {
      alias: "fluent",
      path: "fluent",
    },
  ];
  sets.forEach((e) => {
    registerIconLibrary(e.alias, {
      resolver: (name) => `/assets/icons/${e.path}/${name}.svg`,
    });
  });
}
