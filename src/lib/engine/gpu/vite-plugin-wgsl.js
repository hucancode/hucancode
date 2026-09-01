import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { reflectWGSL } from "./wgsl-reflect.js";

const run = promisify(execFile);
const QUERY = "?shader";

async function nagaToGLSL(file, entry) {
  const dir = await mkdtemp(path.join(tmpdir(), "naga-"));
  const out = path.join(dir, entry === "vs" ? "out.vert" : "out.frag");
  try {
    await run("naga", [
      file,
      out,
      "--entry-point",
      entry,
      "--profile",
      "es300",
      "--keep-coordinate-space",
    ]);
    return await readFile(out, "utf8");
  } catch (e) {
    const detail =
      e.code === "ENOENT"
        ? "naga not found — install with `cargo install naga-cli`"
        : e.stderr || e.message;
    throw new Error(`naga ${entry} failed for ${file}:\n${detail}`);
  } finally {
    rm(dir, { recursive: true, force: true });
  }
}

function flipVertexY(src) {
  const re = /void\s+main\s*\(\s*\)/;
  if (!re.test(src))
    throw new Error(
      "naga vertex output has no `void main()`; cannot emit flipped variant",
    );
  return (
    src.replace(re, "void main_body()") +
    "\nvoid main() { main_body(); gl_Position.y = -gl_Position.y; }\n"
  );
}

// Read sampler uniform names back from naga's actual output, keyed by binding
// index and stage. This keeps the WebGL backend free of any assumption about
// naga's naming convention — if naga ever changes it, the build fails here
// with a clear error instead of silently dropping texture bindings at runtime.
function extractSamplers(glslSrc) {
  const map = {};
  const re =
    /uniform\s+(?:highp\s+|mediump\s+|lowp\s+)?sampler\w+\s+(_group_0_binding_(\d+)_(vs|fs))\s*;/g;
  let m;
  while ((m = re.exec(glslSrc))) {
    map[+m[2]] = m[1];
  }
  return map;
}

export function wgslPlugin() {
  return {
    name: "wgsl-shader",
    enforce: "pre",
    async load(id) {
      if (!id.endsWith(QUERY)) return null;
      const file = id.slice(0, -QUERY.length);
      this.addWatchFile(file);
      const wgsl = await readFile(file, "utf8");
      const reflect = reflectWGSL(wgsl);
      let glsl = null;
      if (reflect.vertexEntry) {
        const [vertex, fragment] = await Promise.all([
          nagaToGLSL(file, "vs"),
          nagaToGLSL(file, "fs"),
        ]);
        glsl = {
          vertex,
          fragment,
          vertexFlipped: flipVertexY(vertex),
          samplers: {
            vs: extractSamplers(vertex),
            fs: extractSamplers(fragment),
          },
        };
      }
      return `export default ${JSON.stringify({ wgsl, glsl, reflect })};`;
    },
  };
}
