// Serialize a live model back to the source form used by dragon.js / eagle.js,
// so an edited model can be pasted straight into a template file.

function js(v) {
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "[" + v.map(js).join(", ") + "]";
  if (v && typeof v === "object")
    return (
      "{ " +
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => `${k}: ${js(x)}`)
        .join(", ") +
      " }"
    );
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}

// pretty-print a tree node, nesting `children` one level per depth
function jsNode(node, ind) {
  const pad = "  ".repeat(ind),
    pad2 = "  ".repeat(ind + 1);
  const { children, ...rest } = node;
  let body = Object.entries(rest)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${js(v)}`)
    .join(", ");
  if (children?.length) {
    const kids = children.map((c) => `${pad2}${jsNode(c, ind + 1)}`).join(",\n");
    body += `, children: [\n${kids}\n${pad}]`;
  }
  return `{ ${body} }`;
}

export function serializeModel(m) {
  const parts = Object.entries(m.parts)
    .map(([id, s]) => `    ${id}: ${js(s)},`)
    .join("\n");
  return `export const MODEL = {\n  parts: {\n${parts}\n  },\n  baseY: ${js(m.baseY ?? 0)},\n  root: ${jsNode(m.root, 1)},\n};`;
}
