// Fullscreen background billboard. Renders the paper colour + grain so the
// stroke shader can stay alpha-only (no internal bg composite).
import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import BASIC_VERT from "$lib/playgrounds/shaders/basic.vert.glsl?raw";
import PAPER_FRAG from "$lib/playgrounds/shaders/paper-background.frag.glsl?raw";

export function makePaperBackground({ bgColor, aspectUniform }) {
  const material = new ShaderMaterial({
    uniforms: {
      uAspect:  aspectUniform,
      uBgColor: { value: bgColor },
    },
    vertexShader:   BASIC_VERT,
    fragmentShader: PAPER_FRAG,
    transparent: false,
    depthWrite: true,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, material };
}

export function disposePaperBackground(bg) {
  if (!bg) return;
  if (bg.mesh) bg.mesh.geometry.dispose();
  if (bg.material) bg.material.dispose();
}
