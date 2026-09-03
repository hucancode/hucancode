<script>
  import "katex/dist/katex.css";
  import "$styles/collision.css";
  import Tex from "$lib/components/calculus/Tex.svelte";
  import SphereSpherePlayground from "$lib/components/collision/SphereSpherePlayground.svelte";
  import SphereBoxPlayground from "$lib/components/collision/SphereBoxPlayground.svelte";
  import SphereCylinderPlayground from "$lib/components/collision/SphereCylinderPlayground.svelte";
  import ProjectionPlayground from "$lib/components/collision/ProjectionPlayground.svelte";
  import SatPlayground from "$lib/components/collision/SatPlayground.svelte";
  import CylinderCylinderPlayground from "$lib/components/collision/CylinderCylinderPlayground.svelte";
  import BoxCylinderPlayground from "$lib/components/collision/BoxCylinderPlayground.svelte";
  import BvhBoundsPlayground from "$lib/components/collision/BvhBoundsPlayground.svelte";
  import BvhBuildPlayground from "$lib/components/collision/BvhBuildPlayground.svelte";
  import BvhQueryPlayground from "$lib/components/collision/BvhQueryPlayground.svelte";
  import {
    jsSphereSphere,
    jsSphereBox,
    jsSphereCylinder,
    jsSat,
    jsCylinderCylinder,
    jsBoxCylinder,
    jsAabb,
    jsBuildBVH,
    jsQueryBVH,
  } from "$lib/playgrounds/collision/snippets.js";
</script>

<svelte:head>
  <title>Primitive Collision Detection</title>
</svelte:head>

<article class="collision">
  <header class="hero">
    <h1>Collision Detection</h1>
    <p class="lede">
      A game and physics engine asks one question thousands of times per frame: <em>are these two shapes
      touching, and if so, where?</em> For convex primitives — spheres, boxes, cylinders — the answer is pure
      computational geometry: distances, closest points, projection intervals. Let me introduce that to you.
    </p>
  </header>

  <section id="pipeline" class="chapter">
    <h2>The pieces</h2>
    <p class="concept">
      A collision detector takes two shapes and returns a <em>contact manifold</em>: the normal between them,
      the penetration depth, and one or more contact points. In practice the work is split in two: a cheap
      reject that discards pairs which are far apart, and the exact primitive test. Chapters 1–6 below are the
      exact tests; chapter 7 builds the cheap reject out of bounding boxes. What happens <em>after</em> a
      contact is produced (impulses, friction, resting stacks) is collision resolution, and deliberately out
      of scope on this page.
    </p>
    <ul class="primitives">
      <li><b>sphere</b> — a center point and a radius.</li>
      <li><b>box</b> — half extents and an orientation.</li>
      <li><b>cylinder</b> — a radius, a height, and an axis orientation.</li>
    </ul>

    <p class="concept">
      I will use some common notation through out the article. A point is <Tex tex="p" /> (or
      <Tex tex="c" /> for center), radius is <Tex tex="r" />, distance is <Tex tex="d" />, penetration depth
      is <Tex tex="\delta" />, the contact normal is <Tex tex="\hat n" />, half extents are
      <Tex tex="h = (h_x, h_y)" />, and a box orientation is <Tex tex="R" />.
    </p>
  </section>

  <section id="sphere-sphere" class="chapter">
    <h2><span class="num">1</span> Sphere vs sphere</h2>
    <p class="concept">
      Given two spheres <Tex tex="A" /> and <Tex tex="B" /> with centers
      <Tex tex="p_a" />,<Tex tex="p_b" /> and radii <Tex tex="r_a" />, <Tex tex="r_b" />, they overlap exactly when the
      distance between their centers is no more than the sum of their radii. The contact normal is the unit
      vector between the centers, and the penetration depth <Tex tex="\delta" /> is how much the two radii
      overlap along that line:
    </p>
    <Tex display tex={"\\begin{align*}\n    d &= \\lVert p_b - p_a \\rVert \\\\\n    \\delta &= (r_a + r_b) - d \\\\\n    \\hat n &= \\frac{p_b - p_a}{d}\n\\end{align*}"} />

    <div class="playground-wrap">
      <h3>a. The distance test</h3>
      <p class="intro">
        You can drag the circles.
      </p>
      <SphereSpherePlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsSphereSphere}</code></pre>
    </details>
  </section>

  <section id="sphere-box" class="chapter">
    <h2><span class="num">2</span> Sphere vs box</h2>
    <p class="concept">
      Given a sphere with center <Tex tex="p" /> and radius <Tex tex="r" />, and a box with center
      <Tex tex="c" />, half extents <Tex tex="h = (h_x, h_y)" />, and orientation
      <Tex tex="R" /> (whose columns are the box's face axes), the sphere hits the box when the closest point on
      the box is within <Tex tex="r" />. In the box's local frame that closest point is a componentwise clamp:
    </p>
    <Tex display tex={"\\begin{align*}\n    p_{local} &= R^{-1}(p - c) \\\\\n    p_{clamped} &= \\operatorname{clamp}(p_{local},\\, -h,\\, h) \\\\\n    p_{closest} &= c + R\\,p_{clamped}\n\\end{align*}"} />

    <div class="playground-wrap">
      <h3>a. Closest point on a box</h3>
      <p class="intro">
        You can drag the sphere or the box.
      </p>
      <SphereBoxPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsSphereBox}</code></pre>
    </details>
  </section>

  <section id="sphere-cylinder" class="chapter">
    <h2><span class="num">3</span> Sphere vs cylinder</h2>
    <p class="concept">
      Seen from the side a cylinder is a <em>capsule</em>: an axis segment inflated by the radius. The test
      finds the closest point on that axis, then asks which <em>region</em> the sphere center falls in — past an
      end cap, or alongside the curved wall. The region decides the surface normal. Given a sphere with center
      <Tex tex="p" /> and radius <Tex tex="r_s" />, and a cylinder with axis endpoints
      <Tex tex="a" />, <Tex tex="b" /> and radius <Tex tex="r_c" />, the closest point on the segment is a
      clamped projection:
    </p>
    <Tex display tex={"\\begin{align*}\n    w &= b - a \\\\\n    t &= \\operatorname{clamp}\\!\\left(\\frac{(p - a)\\cdot w}{w\\cdot w},\\; 0,\\; 1\\right) \\\\\n    q &= a + t\\,w \\\\[4pt]\n    d &= \\lVert p - q \\rVert \\\\\n    \\delta &= (r_s + r_c) - d\n\\end{align*}"} />
    <p class="concept">
      The parameter <Tex tex="t" /> is the region classifier: <Tex tex={"t = 0"} /> or <Tex tex={"t = 1"} /> puts
      the closest point on an end cap, while <Tex tex={"0 < t < 1"} /> puts it on the curved wall. Either way,
      the sphere overlaps the cylinder when the distance <Tex tex="d" /> is no more than the radius sum
      <Tex tex="r_s + r_c" />.
    </p>

    <div class="playground-wrap">
      <h3>a. Caps, rims, and walls</h3>
      <p class="intro">
        You can drag the sphere or the cylinder.
      </p>
      <SphereCylinderPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsSphereCylinder}</code></pre>
    </details>
  </section>

  <section id="box-box" class="chapter">
    <h2><span class="num">4</span> Box vs box — the Separating Axis Theorem</h2>
    <p class="concept">
      Two convex shapes do <em>not</em> overlap exactly when you can draw a straight line between them. Project
      both shapes onto that line's direction: their projections are two intervals, and if those intervals don't
      touch, the line is a <em>separating axis</em>. For two boxes the only directions that can separate them
      are their <em>face normals</em> (in 2D, four of them; in 3D, six faces plus nine edge cross-products). So
      the infinite question collapses to a handful of dot products. Given a box with center
      <Tex tex="c" />, half extents <Tex tex="h_x,\ h_y" />, and unit face axes
      <Tex tex="a_x,\ a_y" />, projecting it onto a unit axis <Tex tex="\hat n" /> gives an interval
      <Tex tex="I" /> centered at <Tex tex="c\cdot\hat n" /> whose half-width is the projection radius
      <Tex tex="r" />:
    </p>
    <Tex display tex={"\\begin{align*}\n    r &= h_x\\,|\\hat n\\cdot a_x| + h_y\\,|\\hat n\\cdot a_y| \\\\\n    I &= [c\\cdot\\hat n - r,\\; c\\cdot\\hat n + r]\n\\end{align*}"} />

    <div class="playground-wrap">
      <h3>a. Casting a shadow</h3>
      <p class="intro">
        Turn the axis and reshape the box. The green bar is the box's projection.
      </p>
      <ProjectionPlayground />
    </div>

    <div class="playground-wrap">
      <h3>b. Watch it run</h3>
      <p class="concept">
        For two boxes <Tex tex="A" /> and <Tex tex="B" /> with centers
        <Tex tex="c_A,\ c_B" /> and projection radii <Tex tex="r_A,\ r_B" /> (from part <em>a</em>), each
        candidate axis <Tex tex="\hat n" /> turns both into intervals on that line. The gap between the two
        interval centers is <Tex tex="d = |(c_B-c_A)\cdot\hat n|" />, so the intervals overlap by
        <Tex tex="\delta = (r_A + r_B) - d" />. A negative <Tex tex="\delta" /> means the two shadows have a gap —
        a separating line:
      </p>
      <Tex display tex={"\\begin{align*}\n d &= |(c_B - c_A) \\cdot \\hat n| \\\\\n    \\delta &= (r_A + r_B) - d\n\\end{align*}"} />
      <p class="intro">
        You can drag and rotate the boxes. When the boxes overlap, the
        green edge is the <em>reference face</em>, the purple edge is the opposing <em>incident face</em>, the
        green dots are the contact points, and the green arrow is the minimum translation that separates them.
      </p>
      <SatPlayground />
    </div>

    <ol class="steps">
      <li>For each face normal, project both boxes and compute the overlap of the two intervals.</li>
      <li>If any overlap is negative, that axis separates → the boxes are apart.</li>
      <li>Otherwise the axis with the <em>smallest</em> overlap is the contact normal, and its overlap is the
      penetration depth.</li>
      <li>Clip the opposing face against the reference face's sides; what survives is the contact region.</li>
    </ol>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsSat}</code></pre>
    </details>
  </section>

  <section id="cylinder-cylinder" class="chapter">
    <h2><span class="num">5</span> Cylinder vs cylinder</h2>
    <p class="concept">
      In side view a cylinder is a capsule, so two cylinders are two capsule cores: the closest points between
      their axis segments, compared against the radius sum. Given cylinder <Tex tex="A" /> with axis
      <Tex tex="P(s)=p_0+s\,d_1" /> and radius <Tex tex="r_A" />, and cylinder <Tex tex="B" /> with axis
      <Tex tex="Q(t)=q_0+t\,d_2" /> and radius <Tex tex="r_B" />, the test is just the distance between the two
      segments:
    </p>
    <Tex display tex={"\\begin{align*}\n    d &= \\min_{s,t \\in [0,1]} \\lVert P(s) - Q(t) \\rVert \\\\\n    \\delta &= (r_A + r_B) - d\n\\end{align*}"} />
    <p class="concept">
      The minimizer <Tex tex="(s,t)" /> is the standard segment-to-segment closest-point solve (see the JS
      below). When the axes are nearly parallel that solve degenerates, so the test switches to a circle check:
      confirm the two axis intervals overlap along <Tex tex="\hat u" />, then compare the perpendicular distance
      between the axes:
    </p>
    <Tex display tex={"\\begin{align*}\n    \\hat u &= \\frac{d_1}{\\lVert d_1 \\rVert} \\\\\n    s &= q_0 - p_0 \\\\\n    s_\\perp &= s - (s\\cdot\\hat u)\\,\\hat u \\\\\n    d &= \\lVert s_\\perp \\rVert \\\\\n    \\hat n &= \\frac{s_\\perp}{d} \\\\\n    \\delta &= (r_A + r_B) - d\n\\end{align*}"} />

    <div class="playground-wrap">
      <h3>a. Closest points between axes</h3>
      <p class="intro">
        You can play drag and tilt the cylinders
      </p>
      <CylinderCylinderPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsCylinderCylinder}</code></pre>
    </details>
  </section>

  <section id="box-cylinder" class="chapter">
    <h2><span class="num">6</span> Box vs cylinder</h2>
    <p class="concept">
      A box and a cylinder meet through the cylinder's axis. The distance from a convex box to that axis is the
      minimum of four segment-to-edge distances, so the test takes the closest points between the axis and each
      box edge and keeps the nearest pair. That distance is compared against the cylinder radius. With the axis
      segment <Tex tex="[a,b]" /> and box corners <Tex tex="c_0..c_3" />:
    </p>
    <Tex display tex={"\\begin{align*}\n    d &= \\min_{i=0,\\dots,3}\\; d_i \\\\\n    \\delta &= r_c - d\n\\end{align*}"} />
    <p class="concept">
      Each <Tex tex="d_i" /> is the segment-to-segment distance from chapter 5. With
      <Tex tex="r_c" /> the cylinder radius, the winning pair also gives the contact normal
      <Tex tex={"\\hat n = (p_{axis} - p_{box})/d"} />, pointing from the box
      toward the axis.
    </p>

    <div class="playground-wrap">
      <h3>a. Axis against box edges</h3>
      <p class="intro">
        Drag the box or the cylinder. The green dot is the closest point on the box, the amber dot is the closest
        point on the cylinder axis, and the dashed line between them is the distance compared against the
        cylinder radius.
      </p>
      <BoxCylinderPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsBoxCylinder}</code></pre>
    </details>
  </section>

  <section id="bvh" class="chapter">
    <h2><span class="num">7</span> Bounding volume hierarchies</h2>
    <p class="concept">
      The tests in chapters 1–6 are exact but not free. With hundreds of shapes, testing every pair is
      <Tex tex="O(n^2)" /> — and nearly all of those pairs are nowhere near each other. A bounding volume hierarchy
      avoids that in three steps: wrap each shape in a box, merge nearby boxes into bigger boxes recursively,
      then query the tree and only test the leaves that survive. The node of choice is the axis-aligned box
      (AABB) — it is the cheapest volume to build, merge, and test.
    </p>

    <div class="playground-wrap">
      <h3>a. A box around every shape</h3>
      <p class="intro">
        You can drag the boxes.
      </p>
      <BvhBoundsPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsAabb}</code></pre>
    </details>

    <div class="playground-wrap">
      <h3>b. Group and merge</h3>
      <p class="intro">
        You can step through the tree levels.
      </p>
      <BvhBuildPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsBuildBVH}</code></pre>
    </details>

    <div class="playground-wrap">
      <h3>c. Query the tree</h3>
      <p class="intro">
        You can drag the query box and resize it. See how the tree answer your query.
      </p>
      <BvhQueryPlayground />
    </div>

    <details class="code">
      <summary>JS</summary>
      <pre><code>{jsQueryBVH}</code></pre>
    </details>

    <ol class="steps">
      <li>Wrap each shape in an axis-aligned box — the cheapest volume to build and test.</li>
      <li>Recursively merge nearby boxes (median split along the widest axis) until one root box holds
      everything.</li>
      <li>To query, test the root box; recurse only into boxes that overlap; every surviving leaf is a
      candidate to test.</li>
    </ol>
  </section>

  <footer class="closing">
    <p>
      And that was an introduction to collision detection. Hope you find this interesting as I do! Happy learning.
    </p>
  </footer>
</article>

<style>
  .collision .steps {
    margin: 0;
    padding-left: 1.4rem;
    max-width: 52rem;
    display: grid;
    gap: 0.4rem;
  }

  .collision .primitives {
    margin: 0;
    padding-left: 1.4rem;
    max-width: 52rem;
    display: grid;
    gap: 0.3rem;
  }
</style>
