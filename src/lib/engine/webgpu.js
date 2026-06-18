// Thin WebGPU device toolkit — the parallel of gl.js makeContext for the WebGPU
// backend(s). Owns only the boilerplate every WebGPU renderer needs: acquire an
// adapter + device, configure the canvas swapchain, and report the preferred
// format. Pipelines, buffers and draws live in the backend that uses this, the
// same way scenes own their programs/draws over gl.js.
//
// Standard WGPU init; the only environment assumption is `navigator.gpu`. Call
// is async (adapter/device requests are promises). Throws if WebGPU is absent
// or no adapter is granted, so createRenderer() (backend.js) can fall back.

export async function makeWebGPUContext(canvas, opts = {}) {
  if (typeof navigator === "undefined" || !navigator.gpu)
    throw new Error("WebGPU not available");
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: opts.powerPreference || "high-performance",
  });
  if (!adapter) throw new Error("no WebGPU adapter");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context unavailable");
  const format = navigator.gpu.getPreferredCanvasFormat();
  // premultiplied alpha matches the WebGL backend's blend setup.
  const alphaMode = opts.alphaMode || "premultiplied";
  context.configure({ device, format, alphaMode });

  // resize the backing store; call on canvas size changes before the next frame.
  function resize(w, h, dpr = 1) {
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
  }

  return { device, context, format, alphaMode, resize };
}
