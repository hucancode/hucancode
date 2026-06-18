<script>
  import rough from "roughjs";

  let {
    svg, // raw <svg> string (import with ?raw)
    roughness = 0.15,
    bowing = 0,
    strokeWidth = 1, // outline width for stroked icons
    fillStyle = "hachure",
    fillWeight = 1,
    hachureGap = 2.3,
    seed = 1,
    ...rest
  } = $props();

  let outEl = $state(null);

  function pts(el) {
    const nums = (el.getAttribute("points") || "").trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], nums[i + 1]]);
    return out;
  }

  function roughNode(rc, el) {
    const tag = el.tagName.toLowerCase();
    const fillAttr = el.getAttribute("fill");
    const strokeAttr = el.getAttribute("stroke");
    const filled = fillAttr && fillAttr !== "none";
    const sw = parseFloat(el.getAttribute("stroke-width"));
    const o = {
      roughness,
      bowing,
      seed,
      stroke: strokeAttr === "none" ? "none" : "currentColor",
      strokeWidth: filled ? strokeWidth : sw || 1.4,
    };
    if (filled) {
      o.fill = "currentColor";
      o.fillStyle = fillStyle;
      o.fillWeight = fillWeight;
      o.hachureGap = hachureGap;
    }
    const n = (a) => parseFloat(el.getAttribute(a)) || 0;
    switch (tag) {
      case "path": {
        const d = el.getAttribute("d");
        return d ? rc.path(d, o) : null;
      }
      case "circle": return rc.circle(n("cx"), n("cy"), n("r") * 2, o);
      case "ellipse": return rc.ellipse(n("cx"), n("cy"), n("rx") * 2, n("ry") * 2, o);
      case "rect": return rc.rectangle(n("x"), n("y"), n("width"), n("height"), o);
      case "line": return rc.line(n("x1"), n("y1"), n("x2"), n("y2"), o);
      case "polygon": return rc.polygon(pts(el), o);
      case "polyline": return rc.linearPath(pts(el), o);
    }
    return null;
  }

  function build() {
    if (!outEl || !svg) return;
    const src = new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("svg");
    if (!src) return;
    outEl.setAttribute("viewBox", src.getAttribute("viewBox") || "0 0 24 24");
    while (outEl.firstChild) outEl.removeChild(outEl.firstChild);
    const rc = rough.svg(outEl);
    for (const el of src.querySelectorAll("path,circle,rect,line,polygon,polyline,ellipse")) {
      const node = roughNode(rc, el);
      if (node) outEl.appendChild(node);
    }
  }

  $effect(() => {
    svg;
    roughness;
    seed;
    build();
  });
</script>

<svg bind:this={outEl} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...rest}></svg>
