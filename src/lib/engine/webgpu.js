// Thin WebGPU device toolkit. Acquires adapter + device, configures canvas
// swapchain, reports preferred format. Throws if WebGPU absent or no adapter
// granted, so createDevice() (gpu/) can fall back to WebGL2.

export async function makeWebGPUContext(canvas, opts = {}) {
  if (typeof navigator === "undefined" || !navigator.gpu)
    throw new Error("WebGPU not available");
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: opts.powerPreference || "high-performance",
  });
  if (!adapter) throw new Error("no WebGPU adapter");
  // Reject software adapters (llvmpipe / SwiftShader / etc): CPU render, far
  // slower than WebGL2 fallback on real hardware. opts.allowSoftware overrides.
  if (!opts.allowSoftware) {
    if (adapter.isFallbackAdapter) throw new Error("WebGPU adapter is software (fallback)");
    const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
    const sig = info ? `${info.vendor || ""} ${info.architecture || ""} ${info.device || ""} ${info.description || ""}`.toLowerCase() : "";
    if (/swiftshader|llvmpipe|lavapipe|softpipe|software|basic render|microsoft basic/.test(sig))
      throw new Error("WebGPU adapter is software: " + sig.trim());
  }
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU canvas context unavailable");
  const format = navigator.gpu.getPreferredCanvasFormat();
  // premultiplied alpha matches WebGL backend's blend setup
  const alphaMode = opts.alphaMode || "premultiplied";
  context.configure({ device, format, alphaMode });

  function resize(w, h, dpr = 1) {
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
  }

  return { device, context, format, alphaMode, resize };
}
