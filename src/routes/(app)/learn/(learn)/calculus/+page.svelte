<script>
  import "katex/dist/katex.css";
  import Tex from "$lib/components/calculus/Tex.svelte";
  import TangentPlayground from "$lib/components/calculus/TangentPlayground.svelte";
  import DerivativePlayground from "$lib/components/calculus/DerivativePlayground.svelte";
  import DifferentialPlayground from "$lib/components/calculus/DifferentialPlayground.svelte";
  import RiemannPlayground from "$lib/components/calculus/RiemannPlayground.svelte";
  import FTCPlayground from "$lib/components/calculus/FTCPlayground.svelte";
</script>

<svelte:head>
  <title>Intro to Calculus</title>
</svelte:head>

<article>
  <header class="hero">
    <h1>Intro to Calculus</h1>
    <p class="lede">
      I was struggling with calculus when I was a student. I hope this little playground helps you get started on your math journey
    </p>
  </header>

  <section id="derivative" class="chapter">
    <h2><span class="num">1</span>Derivative</h2>
    <p class="concept">
      The derivative <Tex tex="f'(x)" /> is the <em>instantaneous rate of change</em>: the slope of the line that
      just touches the curve at <Tex tex="x" />. To find it, connect two nearby points with a secant line and let
      their gap <Tex tex="h" /> shrink to nothing:
    </p>
    <Tex display tex="f'(x) = \lim_&#123;h\to 0&#125; \frac&#123;f(x+h)-f(x)&#125;&#123;h&#125;" />

    <div class="playground-wrap">
      <h3>a. From secant to tangent</h3>
      <p class="intro">
        Drag the point on the curve, then slide <Tex tex="h" /> toward zero. Watch the secant line become the
        tangent line.
      </p>
      <TangentPlayground />
    </div>

    <div class="playground-wrap">
      <h3>b. The derivative is a function</h3>
      <p class="intro">
        The slope has a value at <em>every</em> point, so it forms its own curve — <Tex tex="f'(x)" /> (dashed).
        Drag and read the slope.
      </p>
      <DerivativePlayground />
    </div>
  </section>

  <section id="differential" class="chapter">
    <h2><span class="num">2</span> Differential</h2>
    <p class="concept">
      If <Tex tex="x" /> moves by a small step <Tex tex="dx" />, the function changes by
      <Tex tex="\Delta y = f(x+dx)-f(x)" />. The differential <Tex tex="dy = f'(x)\,dx" /> is the same change
      measured along the tangent line instead of the curve:
    </p>
    <Tex display tex="dy = f'(x)\,dx, \qquad \Delta y \approx dy" />

    <div class="playground-wrap">
      <h3>The best linear approximation</h3>
      <p class="intro">
        Slide <Tex tex="dx" /> and watch the gap between the tangent's rise (<Tex tex="dy" />) and the curve's rise
        (<Tex tex="\Delta y" />). Then zoom in.
      </p>
      <DifferentialPlayground />
    </div>
  </section>

  <section id="integral" class="chapter">
    <h2><span class="num">3</span> Integral</h2>
    <p class="concept">
      The integral measures <em>accumulation</em>: the signed area under a curve. Slice the region into
      <Tex tex="n" /> thin rectangles (a Riemann sum); as <Tex tex="n\to\infty" /> the sum converges to the exact
      area:
    </p>
    <Tex display tex="\int_a^b f(x)\,dx = \lim_&#123;n\to\infty&#125; \sum_&#123;i=1&#125;^&#123;n&#125; f(x_i)\,\Delta x" />

    <div class="playground-wrap">
      <h3>a. Riemann sums</h3>
      <p class="intro">
        Change <Tex tex="n" />, the limits <Tex tex="a,b" />, and how each rectangle samples the curve. Watch the
        sum settle onto the true area.
      </p>
      <RiemannPlayground />
    </div>

    <div class="playground-wrap">
      <h3>b. The Fundamental Theorem</h3>
      <p class="intro">
        The running area <Tex tex="F(x)=\int_a^x f" /> is drawn in green. Slide <Tex tex="b" /> and notice its
        slope at <Tex tex="b" /> equals <Tex tex="f(b)" />.
      </p>
      <FTCPlayground />
    </div>
    <p>
      The derivative measures change, the differential predicts locally, and the integral accumulates — and the
      Fundamental Theorem ties the two ends together: <Tex tex="F'(x) = f(x)" />.
    </p>
  </section>

  <footer class="closing">
    That was my humble introduction to calculus. I know school can make it looks daunting, I believe getting back to
    the very basic and see the tool as something works for us will give us some motivation to learn it better. Happy learning!
  </footer>
</article>

<style>
  @media (min-width: 880px) {
    article :global(.playground) {
      grid-template-columns: minmax(0, 1.65fr) minmax(16rem, 0.85fr);
      align-items: start;
    }
  }

  article :global(.readout output[data-mood="rising"]) {
    color: #16a34a;
  }
  article :global(.readout output[data-mood="falling"]) {
    color: #dc2626;
  }

  /* ---- graph (SVG) ------------------------------------------------------ */

  article :global(.graph) {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 0.4rem;
  }
  article :global(.graph .bg) {
    fill: transparent;
  }
  article :global(.graph .grid line) {
    stroke: color-mix(in srgb, var(--ink) 12%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .axes line) {
    stroke: color-mix(in srgb, var(--ink) 60%, transparent);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .ticks text) {
    fill: color-mix(in srgb, var(--ink) 70%, transparent);
    font-size: 10px;
    text-anchor: middle;
    font-family: ui-monospace, monospace;
  }
  article :global(.graph .ticks text.ytick) {
    text-anchor: end;
  }
  article :global(.graph .overlay) {
    cursor: grab;
    touch-action: none;
    fill: transparent;
  }
  article :global(.graph .overlay:active) {
    cursor: grabbing;
  }

  article :global(.graph :is(.curve, .tangent, .secant, .deriv, .accum, .guide, .guide-dx, .guide-dy, .guide-actual)) {
    fill: none;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .curve) {
    stroke: #2563eb;
    stroke-width: 2.5;
  }
  article :global(.graph .tangent) {
    stroke: #dc2626;
    stroke-width: 2;
    opacity: 0.9;
  }
  article :global(.graph .secant) {
    stroke: #f59e0b;
    stroke-width: 2;
    stroke-dasharray: 6 5;
    opacity: 0.9;
  }
  article :global(.graph .deriv) {
    stroke: #16a34a;
    stroke-width: 2;
    stroke-dasharray: 5 4;
  }
  article :global(.graph .accum) {
    stroke: #16a34a;
    stroke-width: 2.5;
  }
  article :global(.graph .guide) {
    stroke: color-mix(in srgb, var(--ink) 55%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  article :global(.graph .guide-dx) {
    stroke: #0ea5e9;
    stroke-width: 2;
  }
  article :global(.graph .guide-dy) {
    stroke: #dc2626;
    stroke-width: 2;
  }
  article :global(.graph .guide-actual) {
    stroke: #f59e0b;
    stroke-width: 2;
    stroke-dasharray: 4 3;
  }
  article :global(.graph .link) {
    stroke: color-mix(in srgb, var(--ink) 40%, transparent);
    stroke-width: 1;
    stroke-dasharray: 3 4;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .bound) {
    stroke: color-mix(in srgb, var(--ink) 45%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .area) {
    fill: color-mix(in srgb, #2563eb 22%, transparent);
    stroke: none;
  }
  article :global(.graph .rect-pos) {
    fill: color-mix(in srgb, #2563eb 30%, transparent);
    stroke: #2563eb;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .rect-neg) {
    fill: color-mix(in srgb, #dc2626 30%, transparent);
    stroke: #dc2626;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph :is(.point, .point-b, .point-d)) {
    stroke: var(--paper);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph .point) {
    fill: #2563eb;
  }
  article :global(.graph .point-b) {
    fill: #f59e0b;
  }
  article :global(.graph .point-d) {
    fill: #16a34a;
  }

  @media (prefers-color-scheme: dark) {
    article :global(.graph .curve) {
      stroke: #60a5fa;
    }
    article :global(.graph .tangent) {
      stroke: #f87171;
    }
    article :global(.graph .secant) {
      stroke: #fbbf24;
    }
    article :global(.graph .deriv),
    article :global(.graph .accum) {
      stroke: #4ade80;
    }
    article :global(.graph .guide-dx) {
      stroke: #38bdf8;
    }
    article :global(.graph .guide-dy) {
      stroke: #f87171;
    }
    article :global(.graph .guide-actual) {
      stroke: #fbbf24;
    }
    article :global(.graph .area) {
      fill: color-mix(in srgb, #60a5fa 20%, transparent);
    }
    article :global(.graph .rect-pos) {
      fill: color-mix(in srgb, #60a5fa 30%, transparent);
      stroke: #60a5fa;
    }
    article :global(.graph .rect-neg) {
      fill: color-mix(in srgb, #f87171 30%, transparent);
      stroke: #f87171;
    }
    article :global(.graph .point) {
      fill: #60a5fa;
    }
    article :global(.graph .point-b) {
      fill: #fbbf24;
    }
    article :global(.graph .point-d) {
      fill: #4ade80;
    }
    article :global(.readout output[data-mood="rising"]) {
      color: #4ade80;
    }
    article :global(.readout output[data-mood="falling"]) {
      color: #f87171;
    }
  }
</style>
