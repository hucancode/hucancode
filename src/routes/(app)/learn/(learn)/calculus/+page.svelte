<script>
  import "katex/dist/katex.css";
  import Tex from "$lib/components/calculus/Tex.svelte";
  import TangentPlayground from "$lib/components/calculus/TangentPlayground.svelte";
  import DerivativePlayground from "$lib/components/calculus/DerivativePlayground.svelte";
  import DifferentialPlayground from "$lib/components/calculus/DifferentialPlayground.svelte";
  import RiemannPlayground from "$lib/components/calculus/RiemannPlayground.svelte";
  import FTCPlayground from "$lib/components/calculus/FTCPlayground.svelte";
  import PartialDerivativePlayground from "$lib/components/calculus/PartialDerivativePlayground.svelte";
  import GradientPlayground from "$lib/components/calculus/GradientPlayground.svelte";
  import GradientDescentPlayground from "$lib/components/calculus/GradientDescentPlayground.svelte";
</script>

<svelte:head>
  <title>Intro to Calculus</title>
</svelte:head>

<article>
  <header class="hero">
    <h1>Intro to Calculus</h1>
    <p class="lede">
      Calculus is the study of change. It will help us reason about change and motion and everything that is smooth. I was struggling with calculus when I was a student. I hope this little playground helps you get started on your math journey
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
        You can drag the point on the curve.
      </p>
      <TangentPlayground />
    </div>

    <div class="playground-wrap">
      <h3>b. The derivative is a function</h3>
      <p class="intro">
        You can drag the point on the curve.
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
        You can drag the point on the curve.
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
  <section id="partial" class="chapter">
      <h2><span class="num">4</span> Multivariable & Partial Derivatives</h2>
      <div class="bridge-intro">
        <p class="concept">
          So far, every function had one input: <Tex tex="y = f(x)" /> drew a curve on a flat page.
          In the real world, outcomes depend on multiple factors — temperature depends on position <Tex tex="(x,y)" />,
          or profit depends on price and quantity.
        </p>
        <p>
          A function with two inputs, <Tex tex="z = f(x,y)" />, takes a coordinate on the floor <Tex tex="(x,y)" />
          and assigns it a height <Tex tex="z" /> — creating a <strong>3D surface or terrain</strong>.
        </p>
      </div>
      <div class="concept-breakdown">
        <h3>The Infinite Directions Problem</h3>
        <p>
          On a 1D curve, you can only step left or right. On a 3D hill, you can step in <em>any</em> direction.
          How do we measure slope when there are infinite paths?
        </p>
        <p>
          <strong>The trick</strong> is to hold one variable constant! If you freeze <Tex tex="y" />, you slice the 3D surface
          with a vertical plane parallel to the <Tex tex="x\\ axis" />. That slice is just a standard 1D curve, and its slope
          is the <strong>partial derivative</strong> <Tex tex="\partial f/\partial x" />.
        </p>
      </div>
      <Tex display tex="\frac&#123;\partial f&#125;&#123;\partial x&#125; = \lim_&#123;h\to 0&#125; \frac&#123;f(x+h,y)-f(x,y)&#125;&#123;h&#125;" />
      <p class="note">
        <em>Note on notation:</em> We use <Tex tex="\partial" /> (curly <em>d</em>) instead of <Tex tex="d" />
        to signal that <Tex tex="f" /> has other variables being held temporarily still.
      </p>

      <div class="playground-wrap">
        <h3>Slope along each axis</h3>
        <p class="intro">
          Slide <Tex tex="x" /> and <Tex tex="y" /> to move across the hill. Blue shows the east-west
          slope (<Tex tex="\partial f/\partial x" />) holding <Tex tex="y" /> constant. Red shows the north-south
          slope (<Tex tex="\partial f/\partial y" />) holding <Tex tex="x" /> constant.
        </p>
        <PartialDerivativePlayground />
      </div>
    </section>

  <section id="gradient" class="chapter">
    <h2><span class="num">5</span> Gradient</h2>
    <p class="concept">
      Stack both partials into one vector and you get the gradient — it points in the direction of
      steepest ascent, and its length tells you how steep that is:
    </p>
    <Tex display tex="\nabla f = \left(\frac&#123;\partial f&#125;&#123;\partial x&#125;,\ \frac&#123;\partial f&#125;&#123;\partial y&#125;\right)" />

    <div class="playground-wrap">
      <h3>Steepest ascent</h3>
      <p class="intro">
        Slide <Tex tex="x" /> and <Tex tex="y" /> to move the point. The gradient (red) points straight uphill
        in the ground plane.
      </p>
      <GradientPlayground />
    </div>
  </section>

  <section id="descent" class="chapter">
    <h2><span class="num">6</span> Gradient Descent</h2>
    <p class="concept">
      Flip the gradient around and you get the direction of steepest <em>descent</em>. Take small steps
      that way, over and over, and you walk downhill toward a minimum:
    </p>
    <Tex display tex="x_&#123;n+1&#125; = x_n - \eta\,\nabla f(x_n)" />

    <div class="playground-wrap">
      <h3>Rolling downhill</h3>
      <p class="intro">
        This loop — compute the gradient, take a step, repeat — is how every neural network is
        trained. Tune the learning rate <Tex tex="\eta" /> and watch the ball roll down a lopsided
        3D bowl.
      </p>
      <GradientDescentPlayground />
    </div>

    <p>
      Partial derivatives measure slope along one axis, the gradient combines them into "which way is
      up," and gradient descent uses that to automatically find the bottom of a surface — whether that
      surface is terrain, a rendered scene, or the error of a machine learning model.
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
  article :global(.graph .contour) {
    fill: none;
    stroke: #2563eb;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
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

  /* ---- 3D surface (SVG, orbit-only) ------------------------------------ */

  article :global(.graph.surface3d) {
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }
  article :global(.graph.surface3d:active) {
    cursor: grabbing;
  }
  article :global(.graph.surface3d .ground .boundary) {
    fill: none;
    stroke: color-mix(in srgb, var(--ink) 28%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph.surface3d .ground .axis) {
    stroke: color-mix(in srgb, var(--ink) 42%, transparent);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  article :global(.graph.surface3d .net .wire) {
    fill: none;
    stroke: #2563eb;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0.85;
  }
  article :global(.graph .contour3d) {
    fill: none;
    stroke: #2563eb;
    stroke-width: 1.5;
    stroke-dasharray: 5 4;
    vector-effect: non-scaling-stroke;
    opacity: 0.6;
  }
  article :global(.graph .grad-head) {
    fill: #dc2626;
  }

  @media (prefers-color-scheme: dark) {
    article :global(.graph .curve) {
      stroke: #60a5fa;
    }
    article :global(.graph .contour) {
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
    article :global(.graph.surface3d .net .wire) {
      stroke: #60a5fa;
    }
    article :global(.graph .contour3d) {
      stroke: #60a5fa;
    }
    article :global(.graph .grad-head) {
      fill: #f87171;
    }
    article :global(.readout output[data-mood="rising"]) {
      color: #4ade80;
    }
    article :global(.readout output[data-mood="falling"]) {
      color: #f87171;
    }
  }
</style>
