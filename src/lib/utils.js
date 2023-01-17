import { GLTFLoader } from "$lib/three/loaders/GLTFLoader.js";
import * as fs from 'fs';

export function loadModel(url) {
  const loader = new GLTFLoader();
  loader.setPath("/assets/gltf/");
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf), null, reject);
  });
}

export async function loadModelStatic(url) {
  const gltf = await loadModel(url);
  return gltf.scene;
}

export function wait(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export async function randomThumbnail(seed) {
let thumbnails = await fs.promises.readdir("./static/blog/thumbnails");
    const hash = seed.split("").reduce(function(a, b) {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
    const i = Math.abs(hash % thumbnails.length);
    return "/blog/thumbnails/"+thumbnails[i];
}
