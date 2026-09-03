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
  </section>

  <section id="sphere-sphere" class="chapter">
    <h2><span class="num">1</span> Sphere vs sphere</h2>
    <p class="concept">
      Two spheres overlap exactly when the distance
      between their centers is no more than the sum of their radii. The contact normal is the unit vector
      between the centers, and the penetration is how much the two radii overlap along that line:
    </p>
    <Tex display tex={"d = \\lVert p_b - p_a \\rVert, \\qquad \\text{overlap} = (r_a + r_b) - d, \\qquad \\hat n = \\frac{p_b - p_a}{d}"} />

    <div class="playground-wrap">
      <h3>a. The distance test</h3>
      <p class="intro">
        Drag the circles and change the radii. The dashed line is center-to-center distance; when it drops below
        the radius sum the green dot is the contact point and the green arrow is the contact normal.
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
      A sphere hits a box when the <em>closest point on the box</em> to the sphere's center is within the
      sphere's radius. For an axis-aligned box that closest point is a componentwise clamp; for an oriented box
      it is the same clamp done in the box's local frame:
    </p>
    <Tex display tex={"\\text{local} = R^{-1}(p - c), \\qquad \\text{closest} = c + R\\,\\mathrm{clamp}(\\text{local}, -h, h)"} />

    <div class="playground-wrap">
      <h3>a. Closest point on a box</h3>
      <p class="intro">
        Drag the sphere or the box and rotate the box. The green dot is the closest point on the box to the
        sphere center, and the dashed line is the distance that gets compared against the radius.
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
      end cap, or alongside the curved wall. The region decides the surface normal:
    </p>

    <div class="playground-wrap">
      <h3>a. Caps, rims, and walls</h3>
      <p class="intro">
        Drag the sphere or the cylinder and tilt the cylinder. The green dot is the closest point on the axis
        (the readout shows whether it is a <em>cap</em> or <em>side</em> region), and the amber dot is the
        closest point on the surface.
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
      the infinite question collapses to a handful of dot products.
    </p>
    <Tex display tex={"r = h_x\\,|\\hat n\\cdot a_x| + h_y\\,|\\hat n\\cdot a_y|, \\qquad [c\\cdot\\hat n - r,\\; c\\cdot\\hat n + r]"} />

    <div class="playground-wrap">
      <h3>a. Casting a shadow</h3>
      <p class="intro">
        Turn the axis and reshape the box. The green bar is the box's projection — the interval SAT will later
        compare against another shape's shadow.
      </p>
      <ProjectionPlayground />
    </div>

    <div class="playground-wrap">
      <h3>b. Watch it run</h3>
      <p class="intro">
        Drag and rotate the boxes. Every candidate axis is listed with its overlap. When the boxes overlap, the
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
      their axis segments, compared against the radius sum. When the axes are parallel the segment query
      degenerates, so the test falls back to a circle-versus-circle check in the plane across the axis plus an
      axial-overlap check.
    </p>

    <div class="playground-wrap">
      <h3>a. Closest points between axes</h3>
      <p class="intro">
        Drag and tilt the cylinders. When the axes are parallel the test uses the circle-versus-circle fallback;
        when they cross, the green dots are the closest points between the two axis segments and the dashed line
        is the distance compared against the radius sum.
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
      box edge and keeps the nearest pair. That distance is compared against the cylinder radius.
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
        Drag the boxes. Each box's bounding volume is the box itself, and any pair whose boxes overlap survives
        to be tested by the exact tests in chapters 1–6.
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
        Step through the tree levels. Level 0 is one box per object; each level up merges pairs into a parent
        box (split the widest axis at the median), until one box encloses the whole scene.
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
        Drag the query box and resize it. A node whose box misses the query prunes its whole subtree in one
        check; the green boxes are the candidates that actually get tested against each other.
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
      And that's was an introduction to collision detection. Hope you find this interesting as I do!
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
