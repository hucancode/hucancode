// Shader chunk splicing. Shaders ship as plain ?raw strings, so shared code is
// composed here in JS: composeShader() replaces `//#include <chunk-name>`
// marker lines in a variant source with the named chunk below.
import INK_CORE_FRAG_GLSL from "./ink-core.frag.glsl?raw";
import INK_CORE_WGSL from "./ink-core.wgsl?raw";

const CHUNKS = {
  "ink-core.frag.glsl": INK_CORE_FRAG_GLSL,
  "ink-core.wgsl": INK_CORE_WGSL,
};

export function composeShader(source) {
  return source.replace(/^[ \t]*\/\/#include[ \t]+(\S+)[ \t]*$/gm, (line, name) => {
    const chunk = CHUNKS[name];
    if (!chunk) throw new Error(`composeShader: unknown chunk "${name}"`);
    return chunk;
  });
}
