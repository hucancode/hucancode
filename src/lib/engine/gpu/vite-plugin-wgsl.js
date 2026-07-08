// Vite plugin: `import shader from "./foo.wgsl?shader"` returns
// { wgsl, glsl: { vertex, fragment } } — the GLSL ES 3.00 twin is generated at
// build time by naga (cargo install naga-cli) from the same WGSL source, so
// shaders are authored ONCE in WGSL. Entry points must be named vs/fs.
// --keep-coordinate-space because the engine handles clip-space conventions
// itself (correctViewProj); es300 to match WebGL2.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);
const QUERY = "?shader";

async function nagaToGLSL(file, entry) {
  const dir = await mkdtemp(path.join(tmpdir(), "naga-"));
  const out = path.join(dir, entry === "vs" ? "out.vert" : "out.frag");
  try {
    await run("naga", [file, out, "--entry-point", entry, "--profile", "es300", "--keep-coordinate-space"]);
    return await readFile(out, "utf8");
  } catch (e) {
    const detail = e.code === "ENOENT" ? "naga not found — install with `cargo install naga-cli`" : e.stderr || e.message;
    throw new Error(`naga ${entry} failed for ${file}:\n${detail}`);
  } finally {
    rm(dir, { recursive: true, force: true });
  }
}

export function wgslPlugin() {
  return {
    name: "wgsl-shader",
    enforce: "pre",
    async load(id) {
      if (!id.endsWith(QUERY)) return null;
      const file = id.slice(0, -QUERY.length);
      this.addWatchFile(file);
      const [wgsl, vertex, fragment] = await Promise.all([
        readFile(file, "utf8"),
        nagaToGLSL(file, "vs"),
        nagaToGLSL(file, "fs"),
      ]);
      return `export default ${JSON.stringify({ wgsl, glsl: { vertex, fragment } })};`;
    },
  };
}
