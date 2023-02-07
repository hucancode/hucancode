import * as fs from "fs";

export async function randomThumbnail(seed) {
  return new Promise((resolve, reject) => {
    fs.readdir("./static/blog/thumbnails", (err, files) => {
      const hash = seed.split("").reduce(function (a, b) {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      const i = Math.abs(hash % files.length);
      resolve("/blog/thumbnails/" + files[i]);
    });
  });
}
