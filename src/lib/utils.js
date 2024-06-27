import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
loader.setPath("/assets/gltf/");

export function loadModel(url) {
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
