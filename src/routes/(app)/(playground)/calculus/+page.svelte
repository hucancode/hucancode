<script>
  import "katex/dist/katex.css";
  import "$styles/calculus.css";
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

<article class="calculus">
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
    <Tex display tex="f'(x) = \lim&#123;h\to 0&#125; \frac&#123;f(x+h)-f(x)&#125;&#123;h&#125;" />

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
    <Tex display tex="\int_a^b f(x)\,dx = \lim&#123;n\to\infty&#125; \sum&#123;i=1&#125;^&#123;n&#125; f(x_i)\,\Delta x" />

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
  </section>

  <footer class="closing">
    <p>
      The derivative measures change, the differential predicts locally, and the integral accumulates — and the
      Fundamental Theorem ties the two ends together: <Tex tex="F'(x) = f(x)" />.
    </p>
  </footer>
</article>
