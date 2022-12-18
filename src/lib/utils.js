import { GLTFLoader } from "$lib/three/loaders/GLTFLoader.js";

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
