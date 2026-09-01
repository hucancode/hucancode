function stripComments(src) {
  return src.replace(/\/\/[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

function normType(t) {
  const s = t.trim();
  if (s === "f32") return "f32";
  if (s === "i32") return "i32";
  if (s === "u32") throw new Error(`u32 is not supported; use i32 (in "${t}")`);
  const m = s.match(/^(vec[234]|mat4)(?:x\d+)?(?:<f32>)?$/);
  if (m)
    return { vec2: "vec2", vec3: "vec3", vec4: "vec4", mat4: "mat4" }[m[1]];
  throw new Error(`unsupported WGSL type for reflection: "${t}"`);
}

function splitTop(s, delim) {
  const parts = [];
  let depth = 0,
    cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "<") depth++;
    else if (c === ">") depth--;
    if (c === delim && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

function findParams(src, attrRe) {
  const m = attrRe.exec(src);
  if (!m) return null;
  const open = src.indexOf("(", m.index);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return null;
}

function parseStructFields(src, name) {
  const re = new RegExp("struct\\s+" + name + "\\s*\\{([\\s\\S]*?)\\}");
  const m = src.match(re);
  if (!m) throw new Error(`uniform struct "${name}" not found in WGSL`);
  const fields = [];
  for (const part of splitTop(m[1], ",")) {
    const fm = part.trim().match(/^(\w+)\s*:\s*(.+)$/);
    if (fm) fields.push({ name: fm[1], type: normType(fm[2]) });
  }
  return fields;
}

function pairSamplers(textures, samplers) {
  for (const s of samplers) {
    const paired = textures.find((t) => t.binding === s.binding - 1);
    s.texture = paired ? paired.name : null;
  }
  return samplers;
}

function parseBindings(src) {
  const uniforms = { binding: -1, struct: null };
  const textures = [];
  const samplers = [];

  const re =
    /@binding\s*\(\s*(\d+)\s*\)[^;]*?\bvar(?:<\s*([^>]*?)\s*>)?\s+(\w+)\s*:\s*([^;\n]+?);/g;
  let m;
  while ((m = re.exec(src))) {
    const binding = +m[1];
    const storage = m[2] && m[2].trim();
    const name = m[3];
    const type = m[4].trim();
    if (storage) {
      if (storage.startsWith("uniform")) {
        uniforms.struct = type;
        uniforms.binding = binding;
        uniforms.name = name;
      } else
        throw new Error(
          `storage buffers are not supported (render engine is raster-only): "${name}"`,
        );
    } else if (type.startsWith("texture_storage_2d")) {
      throw new Error(
        `storage textures are not supported (render engine is raster-only): "${name}"`,
      );
    } else if (
      type.startsWith("texture_2d") ||
      type.startsWith("texture_depth")
    ) {
      textures.push({ name, binding });
    } else if (type.startsWith("sampler")) {
      samplers.push({ name, binding });
    }
  }
  return { uniforms, textures, samplers };
}

function parseVertexInputs(src) {
  const params = findParams(src, /@vertex\s+fn\s+(\w+)\s*\(/);
  if (!params) return [];
  const inputs = [];
  for (const part of splitTop(params, ",")) {
    const lm = part.match(
      /@location\s*\(\s*(\d+)\s*\)\s*(\w+)\s*:\s*([\w<>,]+)/,
    );
    if (lm)
      inputs.push({ name: lm[2], location: +lm[1], type: normType(lm[3]) });
  }
  inputs.sort((a, b) => a.location - b.location);
  return inputs;
}

export function reflectWGSL(src) {
  const clean = stripComments(src);
  if (/@compute\b/.test(clean))
    throw new Error(
      "compute shaders are not supported",
    );

  const vertexEntry = clean.match(/@vertex\s+fn\s+(\w+)/)?.[1] || null;
  const fragmentEntry = clean.match(/@fragment\s+fn\s+(\w+)/)?.[1] || null;

  const b = parseBindings(clean);
  const uniforms = b.uniforms.struct
    ? parseStructFields(clean, b.uniforms.struct)
    : [];

  return {
    uniforms,
    vertexInputs: vertexEntry ? parseVertexInputs(clean) : [],
    textures: b.textures,
    samplers: pairSamplers(b.textures, b.samplers),
    vertexEntry,
    fragmentEntry,
  };
}
