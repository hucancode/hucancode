export const TYPE_SIZE = {
  f32: 4,
  i32: 4,
  vec2: 8,
  vec3: 12,
  vec4: 16,
  mat4: 64,
};
export const TYPE_ALIGN = {
  f32: 4,
  i32: 4,
  vec2: 8,
  vec3: 16,
  vec4: 16,
  mat4: 16,
};
export const TYPE_COMP = { f32: 1, vec2: 2, vec3: 3, vec4: 4 };
export const VERTEX_FMT = {
  f32: "float32",
  vec2: "float32x2",
  vec3: "float32x3",
  vec4: "float32x4",
};

// Resolve vertex inputs (from reflection) + optional layout into a list of
// named vertex buffers. Each buffer has a `key` (the name callers bind at draw
// time), a `step` ("vertex" | "instance"), and tightly-packed `attributes`.
//
// layout (optional): { bufferKey: { inputs?: [names], step?: "vertex"|"instance" } }
//   - inputs defaults to [bufferKey] for a single-input buffer
//   - any vertex input NOT listed becomes its own buffer, keyed by its own name
export function resolveBuffers(vertexInputs, layout) {
  const byName = new Map(vertexInputs.map((i) => [i.name, i]));
  const grouped = new Map(); // input name -> buffer key
  const buffers = new Map(); // key -> { key, step, attributes }

  const ensure = (key, step) => {
    if (!buffers.has(key))
      buffers.set(key, { key, step: step || "vertex", attributes: [] });
  };

  if (layout) {
    for (const key of Object.keys(layout)) {
      const spec = layout[key] || {};
      const inputs = spec.inputs ?? [key];
      const step = spec.step || "vertex";
      if (step !== "vertex" && step !== "instance")
        throw new Error(`bad vertex-buffer step "${step}" for "${key}"`);
      ensure(key, step);
      for (const name of inputs) {
        if (!byName.has(name))
          throw new Error(
            `vertex buffer "${key}" references unknown vertex input "${name}"`,
          );
        if (grouped.has(name))
          throw new Error(
            `vertex input "${name}" bound to more than one buffer`,
          );
        grouped.set(name, key);
      }
    }
  }

  // ungrouped inputs become their own single-input buffer
  for (const input of vertexInputs) {
    if (!grouped.has(input.name)) {
      grouped.set(input.name, input.name);
      ensure(input.name, "vertex");
    }
  }

  for (const b of buffers.values()) {
    let stride = 0;
    for (const input of vertexInputs) {
      if (grouped.get(input.name) !== b.key) continue;
      if (input.type === "i32")
        throw new Error(
          `integer vertex attribute "${input.name}" is not supported`,
        );
      b.attributes.push({
        name: input.name,
        location: input.location,
        offset: stride,
        type: input.type,
      });
      stride += TYPE_SIZE[input.type];
    }
    b.stride = stride;
  }

  return [...buffers.values()].sort(
    (a, b) => a.attributes[0].location - b.attributes[0].location,
  );
}
